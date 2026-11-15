import { beforeEach, describe, expect, it } from "vitest";
import { aalFromToken } from "../AuthProvider";
import { createDemoClient, demoLastLink, demoReset } from "./client";

const demo = createDemoClient();
const tokenOf = (url: string) => new URL(url, "http://localhost").searchParams.get("token_hash")!;

beforeEach(() => {
  demoReset();
});

describe("modo de demonstração", () => {
  it("organização por hostname: Orvel por omissão, outra com ?org=exemplo", async () => {
    expect((await demo.rpc("get_org_public", { p_host: "localhost" })).data).toMatchObject({ slug: "orvel" });
    expect((await demo.rpc("get_org_public", { p_host: "exemplo" })).data).toMatchObject({ slug: "exemplo" });
    expect((await demo.rpc("get_org_public", { p_host: "localhost" })).data).not.toHaveProperty("keys");
  });

  it("cliente novo: link mágico de uso único, consentimento antes de ver dados", async () => {
    await demo.auth.signInWithOtp({ email: "rui.ficticio@exemplo.test" });
    const link = demoLastLink();
    expect(link?.email).toBe("rui.ficticio@exemplo.test");

    const { error } = await demo.auth.verifyOtp({ token_hash: tokenOf(link!.url), type: "magiclink" });
    expect(error).toBeNull();
    const again = await demo.auth.verifyOtp({ token_hash: tokenOf(link!.url), type: "magiclink" });
    expect(again.error).toMatchObject({ code: "otp_expired" });

    const ctx = (await demo.rpc("get_session_context", { p_org: "demo-org-orvel" })).data as Record<string, unknown>;
    expect(ctx).toMatchObject({ role: "client", consent_required: true });
    expect((await demo.from("clients").select("full_name")).data).toEqual([]);

    await demo.rpc("accept_privacy_notice", { p_notice_id: (ctx.notice as { id: string }).id });
    expect((await demo.from("clients").select("full_name")).data).toEqual([{ full_name: "Rui Fictício" }]);
  });

  it("email sem conta de cliente não recebe link", async () => {
    await demo.auth.signInWithOtp({ email: "ninguem@exemplo.test" });
    expect(demoLastLink()).toBeNull();
  });

  it("equipa: sem MFA não vê nada; com MFA vê só a sua organização e convida", async () => {
    expect((await demo.auth.signInWithPassword({ email: "outra@exemplo.test", password: "x" })).error).toMatchObject({
      code: "invalid_credentials",
    });
    await demo.auth.signInWithPassword({ email: "equipa@exemplo.test", password: "qualquer" });
    expect(aalFromToken((await demo.auth.getSession()).data.session?.access_token)).toBe("aal1");
    expect((await demo.from("clients").select("id")).data).toEqual([]);
    expect((await demo.functions.invoke("invite-client", { body: { client_id: "demo-client-sofia" } })).error).toBeTruthy();

    const enrolled = await demo.auth.mfa.enroll();
    expect(enrolled.data.totp.qr_code).toMatch(/^data:image\/svg\+xml/);
    await demo.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: "123456" });
    expect(aalFromToken((await demo.auth.getSession()).data.session?.access_token)).toBe("aal2");

    const clients = (await demo.from("clients").select("id, organization_id").order("full_name")).data as { organization_id: string }[];
    expect(clients.length).toBe(4);
    expect(clients.every((c) => c.organization_id === "demo-org-orvel")).toBe(true);

    const sent = await demo.functions.invoke("invite-client", { body: { client_id: "demo-client-sofia" } });
    expect(sent.data).toEqual({ ok: true, resent: false });
    expect(demoLastLink()?.email).toBe("sofia.exemplar@exemplo.test");
    const tooSoon = await demo.functions.invoke("invite-client", { body: { client_id: "demo-client-sofia" } });
    expect(await (tooSoon.error as unknown as { context: Response }).context.json()).toEqual({ error: "invite_too_soon" });

    await demo.auth.signOut();
    await demo.auth.signInWithPassword({ email: "equipa@exemplo.test", password: "qualquer" });
    const factors = await demo.auth.mfa.listFactors();
    expect(factors.data.totp).toHaveLength(1);
  });

  it("equipa de outra organização não tem acesso a esta", async () => {
    await demo.auth.signInWithPassword({ email: "equipa.exemplo@exemplo.test", password: "x" });
    const ctx = (await demo.rpc("get_session_context", { p_org: "demo-org-orvel" })).data as Record<string, unknown>;
    expect(ctx.role).toBeNull();
  });
});
