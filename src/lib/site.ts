// Author and contact details shown on the landing footer and in the app's
// sidebar. One place to change them.
const REPO_URL = "https://github.com/ArturNunes21/scopelens";
const EMAIL = "arturnuneso21@gmail.com";

export const SITE = {
  author: "Artur Nunes",
  email: EMAIL,
  githubUrl: "https://github.com/ArturNunes21",
  repoUrl: REPO_URL,
  // GitHub's default "bug" / "enhancement" labels pre-fill the issue form.
  bugReportUrl: `${REPO_URL}/issues/new?labels=bug`,
  ideaUrl: `${REPO_URL}/issues/new?labels=enhancement`,
  // For visitors without a GitHub account.
  bugReportMailto: `mailto:${EMAIL}?subject=${encodeURIComponent("ScopeLens bug report")}`,
};
