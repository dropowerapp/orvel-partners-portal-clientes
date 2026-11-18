import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORG, renderAt } from "../../test/fixtures";
import PublicPrivacy from "./PublicPrivacy";
import ClientLogin from "./ClientLogin";

const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) }, SUPABASE_URL: "" }));
vi.mock("../../lib/OrgProvider", () => ({ useOrg: () => ORG }));
vi.mock("../../lib/AuthProvider", () => ({ useAuth: () => ({ session: null }) }));

describe("aviso antes do login", () => {
  beforeEach(() => rpc.mockReset());

  it("permite abrir o aviso na entrada sem preencher o email", async () => {
    renderAt("/entrar", <ClientLogin />, ["/aviso-de-privacidade"]);
    expect(screen.getByLabelText("Email")).toHaveValue("");
    await userEvent.click(screen.getByRole("link", { name: "Aviso de privacidade" }));
    await screen.findByText("rota:/aviso-de-privacidade");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra a versão publicada sem exigir conta nem confirmar leitura", async () => {
    rpc.mockResolvedValue({ data: { privacy_notice: {
      id: "published", version: 3, retention_days: 30, published_at: "2026-11-18T08:00:00Z",
      body: { "pt-PT": "## Quem trata os dados\n\nA **Orvel** acompanha o seu processo.\n\n- Identificação\n- Contacto" },
    } }, error: null });
    renderAt("/aviso-de-privacidade", <PublicPrivacy />, ["/entrar"]);
    const article = await screen.findByRole("article");
    expect(within(article).getByText("Versão 3")).toBeInTheDocument();
    expect(within(article).getByRole("heading", { name: "Quem trata os dados" })).toBeInTheDocument();
    expect(within(article).getAllByRole("listitem")).toHaveLength(2);
    expect(within(article).getByText("Orvel").tagName).toBe("STRONG");
    expect(screen.getByText("Publicado em 18 de novembro de 2026")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("get_org_public", { p_host: "orvel" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("sem aviso publicado apresenta um estado de preparação, sem inventar texto", async () => {
    rpc.mockResolvedValue({ data: { privacy_notice: null }, error: null });
    renderAt("/aviso-de-privacidade", <PublicPrivacy />, ["/entrar"]);
    await screen.findByText(/O aviso de privacidade ainda está a ser preparado/);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("distingue falha de rede de aviso ausente e permite repetir", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "network" } })
      .mockResolvedValue({ data: { privacy_notice: null }, error: null });
    renderAt("/aviso-de-privacidade", <PublicPrivacy />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText(/O aviso de privacidade ainda está a ser preparado/);
  });

  it("mantém HTML como texto, sem executar conteúdo do aviso", async () => {
    rpc.mockResolvedValue({ data: { privacy_notice: {
      id: "safe", version: 1, retention_days: 30, published_at: "2026-11-18T00:00:00Z",
      body: { "pt-PT": '<img src=x onerror="alert(1)">\n\n<script>alert(1)</script>' },
    } }, error: null });
    renderAt("/aviso-de-privacidade", <PublicPrivacy />);
    const article = await screen.findByRole("article");
    expect(article.querySelector("img,script")).toBeNull();
    expect(article).toHaveTextContent('<script>alert(1)</script>');
  });
});
