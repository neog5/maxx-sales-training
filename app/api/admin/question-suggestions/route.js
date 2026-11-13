import { NextResponse } from "next/server";
import { requireApiViewer } from "@/lib/auth";
import { COURSE_PDF_BUCKET, MAX_PDF_BYTES, materialStoragePathFromUrl, storedDeckSize } from "@/lib/course-materials";
import {
  DEFAULT_GENERATION_COUNTS,
  FREE_PDF_PARSER_MAX_BYTES,
  PDF_TOO_LARGE_MESSAGE,
  generationCountError,
  getResponseText,
  isPdfParserSizeError,
  isPublicCoursePdfUrl,
  openRouterRequestBody,
  parseSuggestionPayload,
  repairMessages,
  suggestionMessageContent,
} from "@/lib/question-suggestions";
import { isAdmin } from "@/lib/roles";

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// How long OpenRouter can fetch the PDF for: long enough for the request and its repair pass.
const PDF_LINK_SECONDS = 15 * 60;
const MODEL_CALL_TIMEOUT_MS = 180_000;
// Stop a little before maxDuration so we can still answer with a useful error.
const REQUEST_BUDGET_MS = 285_000;

function error(message, status) {
  return NextResponse.json({ error: message }, { status });
}

// Aborts when the client goes away or after `milliseconds`, whichever comes first.
function timeoutSignal(signal, milliseconds) {
  const timeout = AbortSignal.timeout(Math.max(1, milliseconds));
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function isAbort(cause) {
  return cause?.name === "AbortError" || cause?.name === "TimeoutError";
}

// OpenRouter fetches the PDF itself through a short-lived signed link (the bucket is
// private), so the Worker never buffers the file (Workers have a 128 MB memory limit).
// Confirms the file exists and returns { bytes, url }.
async function signPdf(supabase, pdfUrl) {
  const path = materialStoragePathFromUrl(pdfUrl);
  const bytes = await storedDeckSize(supabase, path);
  if (bytes === null) throw new Error("Could not reach the course PDF.");
  if (bytes > MAX_PDF_BYTES) throw new Error("The course PDF is too large to process.");
  const { data, error: signError } = await supabase.storage.from(COURSE_PDF_BUCKET).createSignedUrl(path, PDF_LINK_SECONDS);
  if (signError || !data?.signedUrl) throw new Error("Could not reach the course PDF.");
  return { bytes, url: data.signedUrl };
}

// Sends one chat completion. A failed connection is retried once; timeouts and
// cancellations are not, since a retry would outlive the request.
async function postToOpenRouter(body, signal, deadline) {
  const serializedBody = JSON.stringify(body);
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "X-OpenRouter-Title": "Maxx Orthopedics Training Portal",
        },
        body: serializedBody,
        signal: timeoutSignal(signal, Math.min(MODEL_CALL_TIMEOUT_MS, deadline - Date.now())),
      });
    } catch (cause) {
      if (isAbort(cause)) throw cause;
      lastError = cause;
      console.warn("OpenRouter request transport failed", { attempt, code: cause?.cause?.code });
    }
  }
  throw lastError;
}

// Returns { response, payload } for one chat completion.
async function callOpenRouter(body, signal, deadline) {
  const response = await postToOpenRouter(body, signal, deadline);
  return { response, payload: await response.json() };
}

export async function POST(request) {
  const viewer = await requireApiViewer(isAdmin);
  if (viewer.response) return viewer.response;
  const { supabase } = viewer;
  const deadline = Date.now() + REQUEST_BUDGET_MS;

  const {
    courseId,
    materialId,
    readingCount = DEFAULT_GENERATION_COUNTS.reading,
    mainCount = DEFAULT_GENERATION_COUNTS.main,
  } = await request.json().catch(() => ({}));
  if (!courseId) return error("A course is required.", 400);
  const countError = generationCountError({ reading: readingCount, main: mainCount });
  if (countError) return error(countError, 400);
  const counts = { readingCount, mainCount };

  const { data: course, error: courseError } = await supabase.from("courses").select("id, code, title").eq("id", courseId).maybeSingle();
  if (courseError) return error("Could not load the course. Please try again.", 500);
  if (!course) return error("Course not found.", 404);

  // Suggestions come from one deck: the one asked for, or the course's first deck.
  let deckQuery = supabase.from("course_materials").select("id, title, pdf_url").eq("course_id", courseId);
  deckQuery = materialId ? deckQuery.eq("id", materialId) : deckQuery.order("position").order("created_at");
  const { data: deck, error: deckError } = await deckQuery.limit(1).maybeSingle();
  if (deckError) return error("Could not load the course decks. Please try again.", 500);
  if (!deck) return error("Upload a PDF before generating questions.", 400);
  if (!isPublicCoursePdfUrl(deck.pdf_url, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return error("This deck’s PDF is not available for suggestions. Re-upload it and try again.", 400);
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return error("Question suggestions are not configured. Contact the app administrator.", 503);
  }

  const model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
  const pdfEngine = process.env.OPENROUTER_PDF_ENGINE || "cloudflare-ai";
  const requestBody = (messages) => openRouterRequestBody({ model, pdfEngine, messages });

  try {
    const pdf = await signPdf(supabase, deck.pdf_url);
    if (pdfEngine === "cloudflare-ai" && pdf.bytes > FREE_PDF_PARSER_MAX_BYTES) return error(PDF_TOO_LARGE_MESSAGE, 413);
    const firstMessage = { role: "user", content: suggestionMessageContent({ course, deck: { ...deck, pdf_url: pdf.url }, ...counts }) };

    const first = await callOpenRouter(requestBody([firstMessage]), request.signal, deadline);
    if (!first.response.ok) {
      console.error("OpenRouter question generation failed", first.response.status, first.payload?.error?.message);
      if (isPdfParserSizeError(first.payload?.error?.message)) return error(PDF_TOO_LARGE_MESSAGE, 413);
      return error("We couldn’t create suggestions from this PDF. Please try again.", 502);
    }

    try {
      return NextResponse.json({ questions: parseSuggestionPayload(first.payload, readingCount, mainCount) });
    } catch (parseError) {
      console.warn("OpenRouter returned an invalid question payload; attempting a repair pass", {
        model: first.payload?.model,
        finishReason: first.payload?.choices?.[0]?.finish_reason,
        contentLength: getResponseText(first.payload).length,
      });
      const repair = await callOpenRouter(requestBody([firstMessage, ...repairMessages(first.payload, counts)]), request.signal, deadline);
      if (!repair.response.ok) {
        console.error("OpenRouter question repair failed", repair.response.status, repair.payload?.error?.message);
        throw parseError;
      }
      return NextResponse.json({ questions: parseSuggestionPayload(repair.payload, readingCount, mainCount) });
    }
  } catch (cause) {
    // The admin left the page or cancelled: nobody is waiting for an answer.
    if (request.signal.aborted) return error("Request cancelled.", 499);
    if (isAbort(cause)) {
      console.warn("Question suggestion generation timed out");
      return error("Generating suggestions took too long. Try again, or ask for fewer questions.", 504);
    }
    console.error("Question suggestion generation failed", cause);
    return error("Could not generate a complete set of questions. Please try again.", 502);
  }
}
