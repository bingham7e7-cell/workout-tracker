/**
 * Geometry for the original front/back muscle-body diagram. All shapes are
 * plain geometric primitives (ellipses, rounded rects, polygons) authored by
 * hand for this app — not traced or copied from any existing artwork.
 *
 * viewBox: 0 0 240 520. Body is bilaterally symmetric, so most regions are
 * defined once (for the right side, image-left) and mirrored for the left.
 */

export type Shape =
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number; rotate?: number }
  | { type: "rect"; x: number; y: number; width: number; height: number; rx: number }
  | { type: "polygon"; points: string };

export type MuscleShape = { muscleGroupId: string; shapes: Shape[] };

function mirrorShape(s: Shape): Shape {
  const mx = (x: number) => 240 - x;
  switch (s.type) {
    case "ellipse":
      return { ...s, cx: mx(s.cx), rotate: s.rotate ? -s.rotate : s.rotate };
    case "rect":
      return { ...s, x: mx(s.x + s.width) };
    case "polygon":
      return {
        ...s,
        points: s.points
          .split(" ")
          .map((pair) => {
            const [x, y] = pair.split(",").map(Number);
            return `${mx(x)},${y}`;
          })
          .join(" "),
      };
  }
}

/** A muscle shape defined on one side, mirrored to cover both. */
function paired(muscleGroupId: string, shapes: Shape[]): MuscleShape {
  return { muscleGroupId, shapes: [...shapes, ...shapes.map(mirrorShape)] };
}

/** A muscle shape that's already centered/symmetric (drawn once, not mirrored). */
function centered(muscleGroupId: string, shapes: Shape[]): MuscleShape {
  return { muscleGroupId, shapes };
}

// The static body outline, drawn once behind every muscle shape so gaps
// between muscle regions still read as a body rather than empty space.
export const SILHOUETTE: Shape[] = [
  { type: "ellipse", cx: 120, cy: 38, rx: 26, ry: 30 }, // head
  { type: "rect", x: 108, y: 62, width: 24, height: 18, rx: 6 }, // neck
  {
    type: "polygon",
    points: "58,80 182,80 172,160 160,250 150,258 90,258 80,250 68,160",
  }, // torso + hips
  // arms (upper + forearm + hand as one soft capsule per side)
  { type: "rect", x: 28, y: 78, width: 34, height: 118, rx: 17 },
  { type: "rect", x: 22, y: 190, width: 30, height: 108, rx: 15 },
  { type: "ellipse", cx: 37, cy: 308, rx: 15, ry: 18 },
  { type: "rect", x: 178, y: 78, width: 34, height: 118, rx: 17 },
  { type: "rect", x: 188, y: 190, width: 30, height: 108, rx: 15 },
  { type: "ellipse", cx: 203, cy: 308, rx: 15, ry: 18 },
  // legs (thigh + calf + foot as one soft capsule per side)
  { type: "rect", x: 76, y: 250, width: 42, height: 130, rx: 20 },
  { type: "rect", x: 80, y: 370, width: 34, height: 108, rx: 16 },
  { type: "ellipse", cx: 97, cy: 486, rx: 20, ry: 12 },
  { type: "rect", x: 122, y: 250, width: 42, height: 130, rx: 20 },
  { type: "rect", x: 126, y: 370, width: 34, height: 108, rx: 16 },
  { type: "ellipse", cx: 143, cy: 486, rx: 20, ry: 12 },
];

export const FRONT_MUSCLES: MuscleShape[] = [
  paired("front_delts", [{ type: "ellipse", cx: 60, cy: 90, rx: 17, ry: 15 }]),
  paired("side_delts", [{ type: "ellipse", cx: 44, cy: 96, rx: 13, ry: 17 }]),
  paired("chest", [{ type: "ellipse", cx: 90, cy: 108, rx: 30, ry: 22, rotate: -12 }]),
  paired("biceps", [{ type: "rect", x: 30, y: 108, width: 26, height: 62, rx: 13 }]),
  paired("forearms", [{ type: "rect", x: 24, y: 194, width: 24, height: 96, rx: 12 }]),
  centered("abs", [
    { type: "rect", x: 100, y: 138, width: 40, height: 90, rx: 8 },
  ]),
  paired("obliques", [{ type: "rect", x: 78, y: 150, width: 18, height: 74, rx: 8 }]),
  paired("quads", [{ type: "rect", x: 80, y: 256, width: 34, height: 116, rx: 16 }]),
  paired("adductors", [{ type: "rect", x: 112, y: 260, width: 14, height: 92, rx: 7 }]),
  paired("calves", [{ type: "ellipse", cx: 97, cy: 410, rx: 15, ry: 40 }]),
];

export const BACK_MUSCLES: MuscleShape[] = [
  paired("rear_delts", [{ type: "ellipse", cx: 60, cy: 90, rx: 17, ry: 15 }]),
  paired("side_delts", [{ type: "ellipse", cx: 44, cy: 96, rx: 13, ry: 17 }]),
  centered("traps", [
    { type: "polygon", points: "120,64 160,82 150,110 120,118 90,110 80,82" },
  ]),
  centered("upper_back", [{ type: "rect", x: 90, y: 92, width: 60, height: 46, rx: 10 }]),
  paired("lats", [{ type: "rect", x: 66, y: 108, width: 30, height: 66, rx: 14 }]),
  centered("lower_back", [{ type: "rect", x: 96, y: 176, width: 48, height: 40, rx: 8 }]),
  paired("triceps", [{ type: "rect", x: 30, y: 108, width: 26, height: 62, rx: 13 }]),
  paired("forearms", [{ type: "rect", x: 24, y: 194, width: 24, height: 96, rx: 12 }]),
  paired("glutes", [{ type: "ellipse", cx: 100, cy: 250, rx: 24, ry: 22 }]),
  paired("hamstrings", [{ type: "rect", x: 80, y: 268, width: 34, height: 104, rx: 16 }]),
  paired("calves", [{ type: "ellipse", cx: 97, cy: 406, rx: 16, ry: 44 }]),
];
