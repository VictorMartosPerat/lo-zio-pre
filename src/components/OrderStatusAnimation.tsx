import { useMemo } from "react";
import "@/styles/order-animations.css";

export type OrderAnimationStatus =
  | "confirmed"
  | "preparing"
  | "ready"
  | "driving";

const MOZZ = [
  { l: "14%", t: "18%", w: 50, h: 36, rot: -10 },
  { l: "52%", t: "8%",  w: 58, h: 32, rot: 14 },
  { l: "8%",  t: "52%", w: 46, h: 40, rot: 22 },
  { l: "46%", t: "46%", w: 52, h: 36, rot: -18 },
  { l: "64%", t: "60%", w: 44, h: 34, rot: 8 },
  { l: "32%", t: "74%", w: 40, h: 28, rot: -4 },
  { l: "74%", t: "24%", w: 38, h: 30, rot: 30 },
];
const TOMS = [
  { l: "30%", t: "14%" }, { l: "62%", t: "24%" }, { l: "20%", t: "40%" },
  { l: "54%", t: "32%" }, { l: "76%", t: "46%" }, { l: "40%", t: "60%" },
  { l: "24%", t: "70%" }, { l: "60%", t: "78%" }, { l: "82%", t: "64%" },
];
const BASIL = [
  { l: "36%", t: "24%", rot: -22 }, { l: "10%", t: "34%", rot: 35 },
  { l: "68%", t: "38%", rot: -12 }, { l: "44%", t: "54%", rot: 18 },
  { l: "52%", t: "74%", rot: -30 },
];

function ConfirmedScene() {
  return (
    <div className="an-confirmed">
      <div className="spark s1" />
      <div className="spark s2" />
      <div className="spark s3" />
      <div className="spark s4" />
      <div className="spark s5" />
      <img className="pep" src="/animations/peperoncino-halftone.png" alt="" />
      <div className="check-disc">
        <svg className="check-svg" viewBox="0 0 64 64" aria-hidden>
          <path d="M14 33 L27 46 L50 20" />
        </svg>
      </div>
      <div className="script-text">¡Mamma mia!</div>
    </div>
  );
}

function PreparingScene() {
  return (
    <div className="an-prep">
      <div className="brick" />
      <div className="lamp">
        <div className="cord" />
        <div className="shade" />
      </div>
      <div className="light-cone" />
      <div className="shimmer" />
      <div className="timer">
        <span className="dot-live" />
        EN EL HORNO
      </div>
      <div className="oven">
        <div className="base" />
        <div className="dome" />
        <div className="mouth-frame" />
        <div className="mouth">
          <div className="stone" />
          <div className="pizza-mini">
            <div className="dot1" />
            <div className="dot2" />
            <div className="dot3" />
          </div>
          <div className="fire">
            <div className="tongue t1" />
            <div className="tongue t2" />
            <div className="tongue t3" />
            <div className="tongue t4" />
            <div className="tongue t5" />
          </div>
        </div>
      </div>
      <div className="ember e1" />
      <div className="ember e2" />
      <div className="ember e3" />
      <div className="ember e4" />
    </div>
  );
}

function ReadyScene() {
  const oregano = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        l: `${10 + ((i * 37) % 80)}%`,
        t: `${12 + ((i * 53) % 76)}%`,
      })),
    [],
  );
  return (
    <div className="an-ready">
      <div className="halo" />
      <div className="bell-wrap">
        <div className="bell" />
      </div>
      <div className="ding" />
      <div className="ding d2" />
      <div className="plate">
        <div className="pizza">
          <div className="crust" />
          <div className="sauce" />
          <div className="toppings">
            {MOZZ.map((m, i) => (
              <div
                key={`m${i}`}
                className="mozz"
                style={{
                  left: m.l, top: m.t, width: m.w, height: m.h,
                  transform: `rotate(${m.rot}deg)`,
                }}
              />
            ))}
            {TOMS.map((x, i) => (
              <div key={`t${i}`} className="tom" style={{ left: x.l, top: x.t }} />
            ))}
            {BASIL.map((b, i) => (
              <div
                key={`b${i}`}
                className="basil"
                style={{ left: b.l, top: b.t, transform: `rotate(${b.rot}deg)` }}
              />
            ))}
            {oregano.map((o, i) => (
              <div key={`o${i}`} className="oregano" style={{ left: o.l, top: o.t }} />
            ))}
          </div>
        </div>
      </div>
      <div className="steam s1" />
      <div className="steam s2" />
      <div className="steam s3" />
      <div className="steam s4" />
    </div>
  );
}

function DrivingScene() {
  return (
    <div className="an-drive">
      <div className="sun" />
      <div className="clouds">
        <div className="cloud c1" />
        <div className="cloud c2" />
        <div className="cloud c3" />
      </div>
      <div className="hill h1" />
      <div className="hill h2" />
      <div className="hill h3" />
      <div className="road">
        <div className="lane" />
      </div>
      <div className="speed l1" />
      <div className="speed l2" />
      <div className="speed l3" />
      <div className="scooter-wrap">
        <div className="exhaust" />
        <div className="exhaust e2" />
        <div className="exhaust e3" />
        <div className="rider-photo-wrap">
          <img src="/animations/rider-reference.png" className="rider-photo" alt="Repartidor" />
        </div>
      </div>
    </div>
  );
}

const SCENES: Record<OrderAnimationStatus, () => JSX.Element> = {
  confirmed: ConfirmedScene,
  preparing: PreparingScene,
  ready: ReadyScene,
  driving: DrivingScene,
};

interface OrderStatusAnimationProps {
  status: string;
  orderType?: string;
  className?: string;
}

const OrderStatusAnimation = ({ status, orderType, className }: OrderStatusAnimationProps) => {
  const scene: OrderAnimationStatus | null =
    status === "confirmed" ? "confirmed"
    : status === "preparing" ? "preparing"
    : status === "ready"
      ? orderType === "delivery" ? "driving" : "ready"
    : null;

  if (!scene) return null;

  const Scene = SCENES[scene];

  return (
    <div className={`osa osa-${scene}${className ? ` ${className}` : ""}`} aria-hidden>
      <div className="osa-scene">
        <Scene />
      </div>
    </div>
  );
};

export default OrderStatusAnimation;
