import { useMemo } from "react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { PanelEmpty, PanelError, PanelLoading } from "@/components/dashboard/States";
import { formatNumber } from "@/lib/utils";
import type { TurfResponse } from "@/types/maxdiff";

const W = 660;
const H = 300;
const PAD = { top: 16, right: 18, bottom: 42, left: 44 };

/**
 * Reach by portfolio size.
 *
 * Drawn as inline SVG rather than through a charting library: it is one
 * monotone series with clickable points, and a dependency would cost more than
 * it saves. Everything is laid out in a fixed viewBox and scaled by the
 * browser, so it stays sharp and responsive without measuring the container.
 *
 * The y-axis is fixed to 0–100 on purpose. Auto-scaling to the data would
 * stretch a curve that climbs from 41% to 99% across the full height and make
 * a flattening portfolio look like it is still growing steeply.
 */
export function ReachCurve({
  data,
  isLoading,
  error,
  onRetry,
  pendingSize,
  onSelectSize,
}: {
  data?: TurfResponse;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Staged size, so the click lands before the refetch. */
  pendingSize?: number;
  onSelectSize: (k: number) => void;
}) {
  const curve = data?.curve ?? [];

  const geom = useMemo(() => {
    if (!curve.length) return null;
    const maxK = Math.max(...curve.map((p) => p.k));
    const x = (k: number) =>
      PAD.left + ((k - 1) / Math.max(maxK - 1, 1)) * (W - PAD.left - PAD.right);
    const y = (pct: number) => PAD.top + (1 - pct / 100) * (H - PAD.top - PAD.bottom);
    return {
      maxK,
      x,
      y,
      path: curve.map((p, i) => `${i ? "L" : "M"}${x(p.k)},${y(p.reach)}`).join(" "),
      area:
        `M${x(curve[0].k)},${y(0)} ` +
        curve.map((p) => `L${x(p.k)},${y(p.reach)}`).join(" ") +
        ` L${x(curve[curve.length - 1].k)},${y(0)} Z`,
    };
  }, [curve]);

  const active = pendingSize ?? data?.size;
  const knee = data?.knee ?? null;

  return (
    <SectionCard
      tag="turf"
      tagLabel="TURF"
      title="Reach curve"
      description="Share of people reached by the best portfolio at each size. Click a point to jump to that portfolio."
      info={
        <>
          Reach of the best portfolio at every size, so you can see what an extra benefit buys.
          <b> Click a point</b> to switch the portfolio size shown above. The y-axis is fixed to
          0–100 deliberately — auto-scaling would stretch a flattening curve and make it look
          like it is still climbing. The dashed line marks where each further benefit stops
          adding meaningful new reach.
        </>
      }
      footnote={
        data && (
          <>
            {knee ? (
              <>
                Each benefit after the <b>{knee}th</b> adds less than{" "}
                {formatNumber(data.knee_min_gain_pts, 0)} points of new reach — that is where
                the portfolio stops paying for itself.
              </>
            ) : (
              <>
                Reach was still climbing by more than{" "}
                {formatNumber(data.knee_min_gain_pts, 0)} points a benefit at size{" "}
                {data.max_k}, so the curve has not flattened inside the range searched.
              </>
            )}{" "}
            Sizes past{" "}
            {curve.find((p) => !p.exhaustive)?.k ?? data.max_k + 1} are solved by a greedy
            search with swap repair rather than exhaustively, so they are strong but not
            provably optimal.
          </>
        )
      }
    >
      {isLoading && <PanelLoading rows={8} />}
      {error && <PanelError error={error} onRetry={onRetry} />}
      {!isLoading && !error && data && data.base_n === 0 && (
        <PanelEmpty>{data.warning ?? "No respondents match this filter."}</PanelEmpty>
      )}

      {!isLoading && !error && geom && data && data.base_n > 0 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label="Reach by portfolio size"
        >
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={geom.y(t)}
                y2={geom.y(t)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={geom.y(t) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {t}%
              </text>
            </g>
          ))}

          {knee && (
            <g>
              <line
                x1={geom.x(knee)}
                x2={geom.x(knee)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                className="stroke-coke-red"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              {/* Anchored to the FOOT of the line, not the head. The head is
                  where the selected point's value label lives, and the knee is
                  also the default portfolio size — so the two collided in the
                  most common state the chart is ever in. Down here the plot is
                  empty, because a curve that is flattening is high by
                  definition. Flips side near the right edge so a late knee
                  does not push the text out of the viewBox. */}
              <text
                x={
                  geom.x(knee) > W - PAD.right - 72
                    ? geom.x(knee) - 5
                    : geom.x(knee) + 5
                }
                y={H - PAD.bottom - 7}
                textAnchor={geom.x(knee) > W - PAD.right - 72 ? "end" : "start"}
                className="fill-coke-red font-mono text-[9.5px]"
              >
                stops paying
              </text>
            </g>
          )}

          <path d={geom.area} className="fill-viz-pos/10" />
          <path
            d={geom.path}
            fill="none"
            className="stroke-viz-pos"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {curve.map((p) => {
            const on = p.k === active;
            return (
              <g
                key={p.k}
                onClick={() => onSelectSize(p.k)}
                className="cursor-pointer"
                role="button"
                aria-label={`Portfolio of ${p.k}: ${formatNumber(p.reach, 1)}% reach`}
              >
                {/* Generous invisible hit area — the visible dot is 4px and
                    would be a hostile click target on a touch screen. */}
                <circle cx={geom.x(p.k)} cy={geom.y(p.reach)} r={14} fill="transparent" />
                <circle
                  cx={geom.x(p.k)}
                  cy={geom.y(p.reach)}
                  r={on ? 5.5 : 4}
                  className={on ? "fill-coke-red" : "fill-background stroke-viz-pos"}
                  strokeWidth={2}
                />
                {on && (
                  // Above the point normally; below it when reach is high
                  // enough that the label would clip the top of the plot.
                  <text
                    x={geom.x(p.k)}
                    y={
                      geom.y(p.reach) - 13 >= PAD.top + 4
                        ? geom.y(p.reach) - 13
                        : geom.y(p.reach) + 19
                    }
                    textAnchor="middle"
                    className="fill-coke-red font-mono text-[10.5px] font-semibold"
                  >
                    {formatNumber(p.reach, 1)}%
                  </text>
                )}
                <title>
                  {`${p.k} benefits — ${formatNumber(p.reach, 1)}% reach (+${formatNumber(
                    p.incremental,
                    1
                  )} pts)${p.exhaustive ? "" : " · heuristic"}`}
                </title>
              </g>
            );
          })}

          {curve.map((p) => (
            <text
              key={p.k}
              x={geom.x(p.k)}
              y={H - PAD.bottom + 16}
              textAnchor="middle"
              className={
                p.k === active
                  ? "fill-foreground font-mono text-[10px] font-semibold"
                  : "fill-muted-foreground font-mono text-[10px]"
              }
            >
              {p.k}
            </text>
          ))}
          <text
            x={PAD.left + (W - PAD.left - PAD.right) / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[10px]"
          >
            benefits in portfolio
          </text>
        </svg>
      )}
    </SectionCard>
  );
}
