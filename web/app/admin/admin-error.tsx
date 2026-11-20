import { ApiError } from "@/lib/api";
import { Button, ErrorState } from "@/components/ui";

export function AdminError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "NOVA could not complete this admin request.";
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <div className="grid gap-3">
      <ErrorState title="Admin request failed." message={message} requestId={requestId} />
      {requestId && <Button variant="secondary" className="w-fit" onClick={() => navigator.clipboard?.writeText(requestId)}>Copy request ID</Button>}
    </div>
  );
}
