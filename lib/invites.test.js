import test from "node:test";
import assert from "node:assert/strict";
import { parseInviteEmails, signUpErrorMessage } from "./invites.js";

test("sorts pasted emails into new, invalid, existing and already invited", () => {
  const result = parseInviteEmails("New@Example.com, new@example.com;\n<pat@example.com> not-an-email\tHas@Account.com waiting@example.com", {
    existingEmails: ["has@account.com", null],
    invitedEmails: ["Waiting@example.com"],
  });
  assert.deepEqual(result, {
    emails: ["new@example.com", "pat@example.com"],
    invalid: ["not-an-email"],
    existing: ["has@account.com"],
    alreadyInvited: ["waiting@example.com"],
  });
});

test("an empty paste invites nobody", () => {
  assert.deepEqual(parseInviteEmails("  \n ").emails, []);
});

test("explains a refused sign-up and passes other errors through", () => {
  assert.match(signUpErrorMessage("Database error saving new user"), /hasn’t been invited/);
  assert.equal(signUpErrorMessage("Password should be at least 6 characters."), "Password should be at least 6 characters.");
});
