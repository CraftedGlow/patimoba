const PAYJP_API_BASE = "https://api.pay.jp/v1";

function getAuthHeader(): string {
  const secretKey = process.env.PAYJP_SECRET_KEY;
  if (!secretKey) throw new Error("PAYJP_SECRET_KEY is not set");
  return "Basic " + Buffer.from(`${secretKey}:`).toString("base64");
}

export async function payjpPost(
  path: string,
  params: Record<string, string>
): Promise<Response> {
  const body = new URLSearchParams(params).toString();
  return fetch(`${PAYJP_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

export async function payjpGet(path: string): Promise<Response> {
  return fetch(`${PAYJP_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
}
