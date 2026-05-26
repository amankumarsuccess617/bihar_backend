export async function verifyCaptcha(token, remoteIp) {
    const provider = process.env.CAPTCHA_PROVIDER || "recaptcha_v3";
    const secret = process.env.CAPTCHA_SECRET;
    const minScore = Number(process.env.CAPTCHA_MIN_SCORE || 0.5);
  
    if (!secret) throw new Error("CAPTCHA_SECRET not set");
    if (!token) return { ok: false, reason: "captcha token missing" };
  
    if (provider === "recaptcha_v3") {
      const params = new URLSearchParams();
      params.set("secret", secret);
      params.set("response", token);
      if (remoteIp) params.set("remoteip", remoteIp);
  
      const r = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
  
      const data = await r.json();
      if (!data.success) return { ok: false, reason: "captcha failed", data };
  
      const score = Number(data.score || 0);
      if (score < minScore) return { ok: false, reason: "captcha low score", data };
  
      return { ok: true, data };
    }
  
    return { ok: false, reason: "unsupported captcha provider" };
  }