async function main() {
  const base = "http://localhost:4782";
  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const cookies = csrfRes.headers.get("set-cookie") ?? "";

  const body = new URLSearchParams({
    csrfToken,
    email: "admin@example.com",
    password: "admin123",
    redirect: "false",
    json: "true",
  });

  const res = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body,
  });

  console.log("status:", res.status);
  console.log("body:", await res.text());
}

main().catch(console.error);
