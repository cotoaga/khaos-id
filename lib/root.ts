// Single source of truth for the root identity (COT-150, corrected in
// f5b40dd): root is kurt@cotoaga.net — the account that exists and is
// Kurt's living login. The originally drafted kurt@cotoaga.ai never
// existed in prod. Every guard, notify target, and dashboard check
// imports this constant; nobody re-declares it locally.
export const ROOT_EMAIL = "kurt@cotoaga.net";
