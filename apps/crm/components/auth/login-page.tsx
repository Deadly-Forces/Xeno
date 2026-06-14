"use client";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

export default function LoginPage(): JSX.Element {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", { organization: form.get("organization"), email: form.get("email"), password: form.get("password"), callbackUrl: "/", redirect: false });
    if (result?.error) setError("Invalid email or password"); else window.location.assign(result?.url ?? "/");
  }
  return <div className="fixed inset-0 grid place-items-center bg-[#102a24]"><form onSubmit={submit} className="w-full max-w-sm rounded-lg bg-white p-7"><p className="label mb-2">Northstar CRM</p><h1 className="text-2xl font-semibold">Workspace sign in</h1><p className="mt-1 text-sm text-[#64716c]">Access is scoped by organization and role.</p><div className="mt-6 space-y-4"><div><label htmlFor="organization" className="label">Workspace</label><input id="organization" required name="organization" defaultValue="xeno" className="input mt-1" /></div><div><label htmlFor="email" className="label">Email</label><input id="email" required name="email" type="email" className="input mt-1" /></div><div><label htmlFor="password" className="label">Password</label><input id="password" required minLength={8} name="password" type="password" className="input mt-1" /></div>{error && <p className="text-sm text-red-700">{error}</p>}<button className="btn btn-primary w-full" type="submit">Sign in</button></div></form></div>;
}
