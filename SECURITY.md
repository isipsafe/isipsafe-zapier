# Security policy

Please do not open a public issue for security problems.

Report vulnerabilities in this integration or in the isIPsafe service privately through GitHub: open this repository's **Security** tab and choose **Report a vulnerability**. You can also use the form at https://isipsafe.com/contact. We will reply as soon as we can and keep you updated until the issue is fixed.

Only the latest version of the Zapier integration receives security fixes.

## How this integration handles your API key

- The key is stored by Zapier as a secret connection field and is never logged by this code.
- It is sent only to `https://isipsafe.com` in an `Authorization: Bearer` header, never in a URL.
- Zapier's request logs scrub connection secrets; error messages produced here never include the key.
