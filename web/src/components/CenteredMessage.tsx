// Mensagem simples a ecrã inteiro (usada antes de a organização estar carregada).
import { Button } from "./ui";

export function CenteredMessage(
  { title, body, action }: { title: string; body: string; action?: { label: string; onClick: () => void } },
) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-2xl font-semibold text-primary">{title}</h1>
        <p className="mb-6 text-muted">{body}</p>
        {action && <Button onClick={action.onClick}>{action.label}</Button>}
      </div>
    </main>
  );
}
