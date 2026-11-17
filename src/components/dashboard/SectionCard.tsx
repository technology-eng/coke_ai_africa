import { useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tag = "maxdiff" | "latent" | "assoc" | "turf";

/**
 * One analysis panel: method tag, title, the sentence that says how to read
 * it, the table, and a footnote for base sizes and caveats.
 *
 * The description is not decoration. Every table here is easy to misread —
 * shares that sum to 100, bases that differ per row — so the explanation
 * travels with the numbers rather than living in a separate deck.
 *
 * `info` is the longer version: what the controls do and how to read the
 * result, behind an (i). It expands INLINE rather than floating, because Card
 * clips its overflow to keep the corners rounded and an absolutely positioned
 * panel would be cut off at the header.
 */
export function SectionCard({
  tag,
  tagLabel,
  title,
  description,
  info,
  actions,
  footnote,
  className,
  children,
}: {
  tag: Tag;
  tagLabel: string;
  title: string;
  description?: ReactNode;
  /** How to read this panel and what its controls do. Two or three lines. */
  info?: ReactNode;
  actions?: ReactNode;
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Badge variant={tag}>{tagLabel}</Badge>
              <span>{title}</span>
              {info && (
                <button
                  type="button"
                  onClick={() => setShowInfo((v) => !v)}
                  aria-expanded={showInfo}
                  aria-label={`How to read: ${title}`}
                  title={showInfo ? "Hide guidance" : "How to read this panel"}
                  className={cn(
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                    showInfo
                      ? "border-coke-red bg-coke-red text-white"
                      : "border-muted-foreground/40 text-muted-foreground hover:border-coke-red hover:text-coke-red"
                  )}
                >
                  <Info className="h-2.5 w-2.5" />
                </button>
              )}
            </CardTitle>
            {description && <CardDescription className="mt-2">{description}</CardDescription>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>

        {info && showInfo && (
          <div className="mt-3 flex items-start gap-2.5 rounded-md border-l-2 border-l-coke-red bg-muted/50 py-2.5 pl-3 pr-2 text-[11.5px] leading-relaxed text-muted-foreground">
            <div className="min-w-0 flex-1">{info}</div>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Hide guidance"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {children}
        {footnote && (
          <p className="mt-4 border-t pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            {footnote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
