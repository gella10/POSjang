
const BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const getToken = () => {
  return localStorage.getItem("pj_token");
};

export async function api(path, { method = "GET", body } = {}) {
  let res;

  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(getToken()
          ? { Authorization: `Bearer ${getToken()}` }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new Error(
      "Can't reach the server. Check that the backend is running on port 5000."
    );
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && getToken()) {
    localStorage.removeItem("pj_token");
    window.dispatchEvent(new Event("pj-logout"));
  }

  if (!res.ok) {
    throw new Error(
      data.message || "Something went wrong. Try again."
    );
  }

  return data;
}
