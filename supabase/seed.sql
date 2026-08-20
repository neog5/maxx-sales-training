-- Sample data for the Rep Training Portal.
-- Safe to rerun: the sample course is replaced by its stable code.

begin;

delete from public.courses where code = 'DEMO-101';

with sample_course as (
  insert into public.courses (code, title, description, pdf_url, pass_threshold, read_seconds, is_active)
  values (
    'DEMO-101',
    'Product Conversation Fundamentals',
    'A short sample course demonstrating the reading checkpoints and randomized assessment flow.',
    '/sample-course.pdf',
    80,
    30,
    true
  )
  returning id
)
insert into public.questions (
  course_id, question_type, page_number, question_text, options, correct_index, explanation
)
select id, question_type, page_number, question_text, options::jsonb, correct_index, explanation
from sample_course
cross join (values
  ('reading_test', 1, 'What is the recommended first step in a discovery conversation?', '["Present every available feature", "Understand the customer''s goal", "Discuss pricing immediately", "Schedule implementation"]', 1, 'Start by understanding the outcome the customer wants to achieve.'),
  ('reading_test', 2, 'Which response best demonstrates active listening?', '["Changing the subject", "Repeating a script", "Summarizing the customer''s concern", "Offering a discount"]', 2, 'A concise summary confirms that the concern was heard and understood.'),
  ('reading_test', 3, 'What should close a productive product conversation?', '["A clear, agreed next step", "A new list of features", "An unrelated case study", "A longer presentation"]', 0, 'An explicit next step creates shared accountability and momentum.'),
  ('main_test', null, 'Which question is most useful at the start of discovery?', '["Which feature do you want?", "What outcome are you trying to improve?", "Can you sign today?", "Who is our competitor?"]', 1, 'Outcome-focused questions reveal the customer''s real objective before a solution is proposed.'),
  ('main_test', null, 'A customer raises a concern. What should you do first?', '["Defend the product", "Move to the next slide", "Acknowledge and clarify the concern", "End the meeting"]', 2, 'Acknowledging and clarifying prevents assumptions and shows that you are listening.'),
  ('main_test', null, 'What makes a value statement credible?', '["It is as broad as possible", "It links a capability to the customer''s stated goal", "It uses technical language", "It avoids measurable outcomes"]', 1, 'Value is clearest when a relevant capability is connected to an outcome the customer cares about.'),
  ('main_test', null, 'Which is the best way to confirm understanding?', '["Ask no follow-up questions", "Repeat your original pitch", "Summarize what you heard and invite correction", "Send a generic brochure"]', 2, 'A summary plus an invitation to correct it makes the conversation collaborative.'),
  ('main_test', null, 'What is the strongest meeting close?', '["We will be in touch", "Let me know if you have questions", "Agree on an owner and date for the next action", "Review every feature again"]', 2, 'A named owner and date turn interest into a concrete next step.'),
  ('main_test', null, 'When should you introduce a product capability?', '["Before learning anything about the customer", "When it addresses a stated need", "Only after discussing price", "Whenever there is silence"]', 1, 'Capabilities are most relevant after discovery identifies a need they can address.'),
  ('main_test', null, 'What should a concise follow-up message include?', '["Only a thank-you", "A full product manual", "The agreed goals, decisions, and next steps", "New claims not discussed in the meeting"]', 2, 'A useful follow-up preserves alignment on what matters and what happens next.')
as q(question_type, page_number, question_text, options, correct_index, explanation);

commit;
