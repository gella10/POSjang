import React, { useState, useEffect, useMemo, useCallback } from "react";
import { api, getToken } from "./api";

const DEMO_MODE = import.meta.env.DEV;
const peso = (n) =>
  "₱" +
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const money = (n) =>
  Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 });
const STORE_HOURS = "5:00 PM – 12:00 AM";

const photoFor = (m) => {
  // A user-uploaded photo takes priority, then the product's own image filename.
  if (m?.photo) return m.photo;
  if (m?.image) return m.image;

  // Fallbacks for older products that do not yet have an assigned image.
  const n = (m?.name || "").toLowerCase();
  return n.includes("bibimbap")
    ? "/img/bibimbap.jpg"
    : /spam|egg|musubi/.test(n)
      ? "/img/spam.jpg"
      : "/img/bulgogi.jpg";
};
const iconPaths = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  order: (
    <>
      <path d="M3 3v7M7 3v7M3 7h4M5 10v11M14 3v8a3 3 0 0 0 6 0V3M17 3v18" />
    </>
  ),
  menu: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" />
      <path d="M4 5.5V22M8 7h8M8 11h8" />
    </>
  ),
  inventory: (
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 7 9 5 9-5M3 7v10l9 5 9-5V7M12 12v10" />
    </>
  ),
  sales: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 3 3 6-7" />
      <path d="M16 6h4v4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="7.2" />
      <path d="m16 16 5 5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  edit: (
    <>
      <path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
    </>
  ),
  view: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  down: <path d="m6 9 6 6 6-6" />,
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </>
  ),
  cart: (
    <>
      <path d="M3 3h2l2.2 12.5a2 2 0 0 0 2 1.5h8.6a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="10" cy="21" r="1" />
      <circle cx="18" cy="21" r="1" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5" />
      <path d="M4 17v4h16v-4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  alert: (
    <>
      <path d="m12 3 10 18H2L12 3Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
};
function Icon({ name, size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name] || iconPaths.dashboard}
    </svg>
  );
}

function Dropdown({
  value,
  options,
  onChange,
  placeholder = "Select",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const items = options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o,
  );
  const selected = items.find((o) => String(o.value) === String(value));
  return (
    <div className={`custom-select ${className}`} ref={ref}>
      <button
        type="button"
        className={`select-trigger ${open ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected?.label || placeholder}</span>
        <Icon name="down" size={16} />
      </button>
      {open && (
        <div className="select-options" role="listbox">
          {items.map((o) => (
            <button
              type="button"
              role="option"
              aria-selected={String(o.value) === String(value)}
              className={String(o.value) === String(value) ? "selected" : ""}
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder = "Password",
  autoComplete,
  required = true,
  inputRef,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        ref={inputRef}
        className="pill"
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon name={visible ? "eye-off" : "eye"} size={18} />
      </button>
    </div>
  );
}

// The authentication screen is intentionally retained; only the local demo credentials are extended.
function Auth({ onAuth, notify }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "STAFF",
  });
  const [busy, setBusy] = useState(false);
  const passwordRef = React.useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const signup = mode === "signup";
  const forgot = mode === "forgot";
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (forgot) {
        const email = f.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          notify("Enter the email address for your account.", "error");
          return;
        }
        // Demo builds skip the network call; real builds hit the backend.
        // The reply is deliberately generic so it never reveals whether an email is registered.
        if (!DEMO_MODE)
          await api("/auth/forgot-password", {
            method: "POST",
            body: { email },
          });
        notify(
          "If that email is registered, a password reset link has been sent.",
          "ok",
        );
        setMode("login");
        return;
      }
      const email = f.email.trim().toLowerCase();
      const password = f.password.trim();
      if (DEMO_MODE && !signup) {
        const owner = email === "owner@pojang.test" && password === "owner123";
        const cashier = email === "demo@pojang.test" && password === "demo123";
        if (owner || cashier) {
          localStorage.removeItem("pj_token");
          onAuth({
            id: owner ? "demo-owner" : "demo-user",
            fullName: owner ? "Demo Owner" : "Demo Cashier",
            email,
            role: owner ? "OWNER" : "STAFF",
            demo: true,
          });
          notify("Demo login successful.", "ok");
          return;
        }
      }
      if (signup) {
        await api("/auth/register", { method: "POST", body: f });
        notify("Registration request submitted.", "ok");
      } else {
        const d = await api("/auth/login", {
          method: "POST",
          body: { email, password },
        });
        if (d.token) localStorage.setItem("pj_token", d.token);
        onAuth(d.user);
      }
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth">
      <section className="auth-art" aria-hidden="true">
        <div className="band">
          <img className="logo" src="/img/logo.jpg" alt="" />
        </div>
        <img className="plate p1" src="/img/bibimbap.jpg" alt="" />
        <img className="plate p2" src="/img/bulgogi.jpg" alt="" />
        <img className="plate p3" src="/img/spam.jpg" alt="" />
      </section>
      <section className="auth-form">
        <form onSubmit={submit} noValidate>
          <h1>
            {forgot
              ? "Reset password"
              : signup
                ? "Create account"
                : "Welcome back!"}
          </h1>
          {forgot && (
            <p className="auth-hint">
              Enter your account email and we'll send you a link to reset your
              password.
            </p>
          )}
          {signup && (
            <input
              className="pill"
              placeholder="Full name"
              value={f.fullName}
              onChange={set("fullName")}
              autoComplete="name"
              required
            />
          )}
          <input
            className="pill"
            type="email"
            placeholder="Email"
            value={f.email}
            onChange={set("email")}
            autoComplete="email"
            required
            onKeyDown={(e) => {
              if (e.key === "Enter" && !forgot) {
                e.preventDefault();
                passwordRef.current?.focus();
              }
            }}
          />
          {!forgot && (
            <div className="password-anchor">
              <PasswordField
                inputRef={passwordRef}
                value={f.password}
                onChange={set("password")}
                placeholder="Password"
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </div>
          )}
          {signup && (
            <Dropdown
              className="auth-role"
              value={f.role}
              options={[
                { label: "Staff", value: "STAFF" },
                { label: "Owner", value: "OWNER" },
              ]}
              onChange={(v) => setF((old) => ({ ...old, role: v }))}
            />
          )}
          {!signup && (
            <button
              type="button"
              className="link right"
              onClick={() => setMode("forgot")}
            >
              Forgot password?
            </button>
          )}
          <button className="cta" disabled={busy}>
            {busy
              ? "Please wait…"
              : forgot
                ? "Send reset link"
                : signup
                  ? "Sign up"
                  : "Login"}
          </button>
          <p className="swap">
            {forgot ? (
              <button
                type="button"
                className="link"
                onClick={() => setMode("login")}
              >
                Back to login
              </button>
            ) : (
              <>
                {signup ? "Already have an account?" : "No account yet?"}{" "}
                <button
                  type="button"
                  className="link"
                  onClick={() => setMode(signup ? "login" : "signup")}
                >
                  {signup ? "Login" : "Sign up"}
                </button>
              </>
            )}
          </p>
        </form>
      </section>
    </main>
  );
}

const initialMenu = [
  {
    id: 1,
    name: "Jin Ramen Mild",
    category: "Noodles",
    price: 85,
    status: "Active",
    stock: 32,
    image: "/img/jinramen_mild.jpg",
  },
  {
    id: 2,
    name: "Jin Ramen Spicy",
    category: "Noodles",
    price: 85,
    status: "Active",
    stock: 28,
    image: "/img/jinramen_spicy.jpg",
  },
  {
    id: 3,
    name: "Bibimbap",
    category: "Rice Meals",
    price: 180,
    status: "Active",
    stock: 18,
  },
  {
    id: 4,
    name: "Samyang Buldak (Hot Ramen)",
    category: "Noodles",
    price: 100,
    status: "Active",
    stock: 9,
    image: "/img/samyanghot_buldak.jpg",
  },
  {
    id: 5,
    name: "Ddeok Cheese Ramen",
    category: "Noodles",
    price: 75,
    status: "Active",
    stock: 15,
    image: "/img/cheese_ramen.jpg",
  },
  {
    id: 6,
    name: "Leche Flan",
    category: "Desserts",
    price: 105,
    status: "Active",
    stock: 5,
    image: "/img/lecheflan.jpg",
  },
  {
    id: 7,
    name: "Tteokbokki w/ sauce",
    category: "Snacks",
    price: 30,
    status: "Active",
    stock: 12,
    image: "/img/tteokbokki.jpg",
  },
  {
    id: 8,
    name: "Bulgogi Rice",
    category: "Rice Meals",
    price: 160,
    status: "Active",
    stock: 20,
  },
  {
    id: 9,
    name: "Spam Musubi",
    category: "Snacks",
    price: 95,
    status: "Active",
    stock: 24,
  },
  {
    id: 10,
    name: "Kimchi",
    category: "Sides",
    price: 25,
    status: "Active",
    stock: 40,
    image: "/img/kimchi.jpg",
  },
];
const initialStock = [
  {
    id: 1,
    name: "Jin Ramen Mild",
    category: "Noodles",
    stock: 32,
    unit: "packs",
    threshold: 10,
  },
  {
    id: 2,
    name: "Jin Ramen Spicy",
    category: "Noodles",
    stock: 28,
    unit: "packs",
    threshold: 10,
  },
  {
    id: 3,
    name: "Leche Flan",
    category: "Desserts",
    stock: 5,
    unit: "pieces",
    threshold: 10,
  },
  {
    id: 4,
    name: "Cheese",
    category: "Toppings",
    stock: 8,
    unit: "packs",
    threshold: 12,
  },
  {
    id: 5,
    name: "Seaweed",
    category: "Toppings",
    stock: 6,
    unit: "packs",
    threshold: 10,
  },
  {
    id: 6,
    name: "Bulgogi Meat",
    category: "Meat",
    stock: 0,
    unit: "packs",
    threshold: 8,
  },
  {
    id: 7,
    name: "Mikiki",
    category: "Drinks",
    stock: 20,
    unit: "bottles",
    threshold: 8,
  },
];
const sampleOrders = [
  {
    id: "PM-1108-004",
    time: "2:35 PM",
    items: "2 items",
    method: "Cash",
    amount: 200,
    status: "Paid",
  },
  {
    id: "PM-1108-007",
    time: "2:20 PM",
    items: "3 items",
    method: "E-wallet",
    amount: 315,
    status: "Paid",
  },
  {
    id: "PM-1108-012",
    time: "1:58 PM",
    items: "1 item",
    method: "Cash",
    amount: 180,
    status: "Paid",
  },
];
function PageTitle({ eyebrow = "MAIN STORE", title, subtitle, action }) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({ label, value, hint, icon, accent = false }) {
  return (
    <div className={`stat-card ${accent ? "stat-accent" : ""}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon name={icon} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}
function MiniBars({ values, labels, highlight = -1 }) {
  const max = Math.max(1, ...values);
  return (
    <div className="bar-chart">
      <div className="bar-y">
        <span>₱15k</span>
        <span>₱10k</span>
        <span>₱5k</span>
        <span>₱0</span>
      </div>
      <div className="bar-area">
        <div className="grid-lines">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="bars">
          {values.map((v, i) => (
            <div className="bar-col" key={i}>
              <div
                className={`bar ${i === highlight ? "hot" : ""}`}
                style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
              />
              <span>{labels[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Dashboard({ menu, orders, setPage }) {
  const bars = [22, 34, 48, 72, 91, 76, 98, 64, 45];
  const recent = orders.length ? orders.slice(0, 4) : sampleOrders;
  return (
    <div className="page-content">
      <PageTitle
        title="A good day starts here."
        subtitle={`Here's what's cooking at your store today. Store hours: ${STORE_HOURS}.`}
        action={
          <button className="primary-btn" onClick={() => setPage("order")}>
            <Icon name="plus" size={17} /> New order
          </button>
        }
      />
      <div className="stats-grid">
        <Stat
          accent
          label="Today's sales"
          value={peso(12480)}
          hint="↑ 12% compared with yesterday"
          icon="sales"
        />
        <Stat
          label="Transactions"
          value="48"
          hint="4 more than yesterday"
          icon="order"
        />
        <Stat
          label="Average order"
          value={peso(260)}
          hint="Across cash and e-wallet payments"
          icon="cart"
        />
        <Stat
          label="Low-stock items"
          value="4"
          hint="Check your inventory before the rush"
          icon="alert"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h2>Sales throughout the day</h2>
              <p>Today · Hourly performance</p>
            </div>
            <span className="soft-tag">Total ₱12,480</span>
          </div>
          <MiniBars
            values={bars}
            labels={[
              "9 AM",
              "10 AM",
              "11 AM",
              "12 PM",
              "1 PM",
              "2 PM",
              "3 PM",
              "4 PM",
              "5 PM",
            ]}
            highlight={6}
          />
        </section>
        <section className="panel favorites">
          <div className="panel-head">
            <h2>Today's crowd favorites</h2>
            <span className="fire">✦</span>
          </div>
          {[
            {
              name: "Jin Ramen Spicy",
              sold: 34,
              price: 85,
              img: "/img/jinramen_spicy.jpg",
            },
            {
              name: "Tteokbokki w/ sauce",
              sold: 28,
              price: 30,
              img: "/img/tteokbokki.jpg",
            },
            {
              name: "Samyang Buldak",
              sold: 21,
              price: 100,
              img: "/img/samyanghot_buldak.jpg",
            },
          ].map((x) => (
            <div className="favorite-row" key={x.name}>
              <img src={x.img} />
              <div>
                <b>{x.name}</b>
                <small>{x.sold} sold</small>
              </div>
              <strong>{peso(x.price)}</strong>
            </div>
          ))}
        </section>
        <section className="panel transactions">
          <div className="panel-head">
            <div>
              <h2>Recent transactions</h2>
              <p>Latest orders from your store</p>
            </div>
            <button className="text-btn" onClick={() => setPage("sales")}>
              View all <span>→</span>
            </button>
          </div>
          <TransactionTable rows={recent} />
        </section>
        <section className="right-stack">
          <div className="panel quick">
            <h2>Quick actions</h2>
            <div className="quick-actions">
              <button onClick={() => setPage("menu")}>
                <Icon name="plus" /> Add menu item
              </button>
              <button onClick={() => setPage("inventory")}>
                <Icon name="inventory" /> Stock in
              </button>
            </div>
            <small>Keep the menu fresh and shelves ready.</small>
          </div>
          <div className="tip-card">
            <Icon name="alert" />
            <div>
              <b>Running low: Leche Flan</b>
              <p>Only 5 packs left. Review inventory before the next rush.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
function TransactionTable({ rows, showDate = false }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>TRANSACTION</th>
            {showDate && <th>DATE</th>}
            <th>TIME</th>
            <th>PAYMENT</th>
            <th>AMOUNT</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i}>
              <td>
                <b>{r.id || r.order_number}</b>
              </td>
              {showDate && (
                <td>
                  {r._dateKey
                    ? new Date(`${r._dateKey}T00:00:00`).toLocaleDateString(
                        "en-PH",
                        { year: "numeric", month: "short", day: "numeric" },
                      )
                    : "—"}
                </td>
              )}
              <td>
                {r.time ||
                  new Date(r.created_at || Date.now()).toLocaleTimeString(
                    "en-PH",
                    { hour: "numeric", minute: "2-digit" },
                  )}
              </td>
              <td>{r.method || r.payment_method || "Cash"}</td>
              <td>
                <b>{peso(r.amount ?? r.total)}</b>
              </td>
              <td>›</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function POSPage({ menu, setMenu, notify, onOrder }) {
  const [category, setCategory] = useState("All items");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState("Take out");
  const [payment, setPayment] = useState("Cash");
  const [table, setTable] = useState("");
  const [note, setNote] = useState("");
  const categories = [
    "All items",
    "Noodles",
    "Rice Meals",
    "Toppings",
    "Drinks",
    "Take-out",
    "Snacks",
  ];
  const shown = menu.filter(
    (m) =>
      (category === "All items" || m.category === category) &&
      m.name.toLowerCase().includes(search.toLowerCase()) &&
      m.status === "Active",
  );
  const add = (m) =>
    setCart((old) => {
      const found = old.find((x) => x.id === m.id);
      return found
        ? old.map((x) => (x.id === m.id ? { ...x, qty: x.qty + 1 } : x))
        : [...old, { ...m, qty: 1 }];
    });
  const setQty = (id, d) =>
    setCart((old) =>
      old
        .map((x) => (x.id === id ? { ...x, qty: x.qty + d } : x))
        .filter((x) => x.qty > 0),
    );
  const total = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const count = cart.reduce((s, x) => s + x.qty, 0);
  const checkout = () => {
    if (!cart.length) return;
    const o = {
      id: `PM-${Date.now().toString().slice(-8)}`,
      created_at: new Date().toISOString(),
      time: new Date().toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
      }),
      items: `${count} items`,
      method: payment,
      amount: total,
      status: "Paid",
      cart,
    };
    onOrder(o);
    setCart([]);
    setNote("");
    notify("Order placed successfully.", "ok");
  };
  return (
    <div className="page-content pos-page">
      <PageTitle
        title="What's the craving?"
        subtitle="Pick favorites, add to order, and make someone's day."
        action={<span className="order-code">Order #PM-108 · {orderType}</span>}
      />
      <div className="pos-layout">
        <section className="pos-menu">
          <label className="field-search">
            <Icon name="search" />
            <input
              placeholder="Search menu here..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="category-row">
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? "selected" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="food-grid">
            {shown.map((m) => (
              <article className="food-card" key={m.id}>
                <img src={photoFor(m)} alt={m.name} />
                <div className="food-info">
                  <div>
                    <b>{m.name}</b>
                    <small>{m.category}</small>
                  </div>
                  <div className="food-bottom">
                    <strong>{peso(m.price)}</strong>
                    <button onClick={() => add(m)} aria-label={`Add ${m.name}`}>
                      <Icon name="plus" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!shown.length && (
            <div className="empty-state">
              No menu items found. Try another category or search.
            </div>
          )}
        </section>
        <aside className="order-panel">
          <div className="order-panel-head">
            <div>
              <h2>Current order</h2>
              <small>
                {count} items · {table ? `Table ${table}` : "No table selected"}
              </small>
            </div>
            <button
              className="icon-btn"
              onClick={() => {
                setCart([]);
                setNote("");
              }}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="order-type">
            {["Dine in", "Take out"].map((t) => (
              <button
                className={orderType === t ? "active" : ""}
                onClick={() => setOrderType(t)}
                key={t}
              >
                {t}
              </button>
            ))}
          </div>
          {orderType === "Dine in" && (
            <input
              className="plain-input"
              placeholder="Table number"
              value={table}
              onChange={(e) => setTable(e.target.value.replace(/\D/g, ""))}
            />
          )}
          <div className="order-lines">
            {cart.length === 0 ? (
              <div className="order-empty">
                <span>
                  <Icon name="cart" size={26} />
                </span>
                <b>Your order is waiting</b>
                <small>Add a dish to get started.</small>
              </div>
            ) : (
              cart.map((x) => (
                <div className="order-line" key={x.id}>
                  <img src={photoFor(x)} />
                  <div className="order-line-info">
                    <b>{x.name}</b>
                    <small>{peso(x.price)} each</small>
                    <div className="qty-control">
                      <button
                        type="button"
                        aria-label={`Decrease ${x.name} quantity`}
                        onClick={() => setQty(x.id, -1)}
                      >
                        <Icon name="minus" size={13} />
                      </button>
                      <span>{x.qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${x.name} quantity`}
                        onClick={() => setQty(x.id, 1)}
                      >
                        <Icon name="plus" size={13} />
                      </button>
                    </div>
                  </div>
                  <strong>{peso(x.price * x.qty)}</strong>
                </div>
              ))
            )}
          </div>
          <textarea
            className="order-note"
            rows="2"
            placeholder="Add an order note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="order-total">
            <div>
              <span>Subtotal</span>
              <b>{peso(total)}</b>
            </div>
            <div>
              <span>Discount</span>
              <b>{peso(0)}</b>
            </div>
            <div className="grand-total">
              <span>Total</span>
              <strong>{peso(total)}</strong>
            </div>
            <div className="payment-choices">
              {["Cash", "E-wallet"].map((p) => (
                <button
                  className={payment === p ? "active" : ""}
                  key={p}
                  onClick={() => setPayment(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              className="primary-btn checkout"
              disabled={!cart.length}
              onClick={checkout}
            >
              Checkout · {peso(total)} <span>→</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MenuManagement({ menu, setMenu, notify }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All categories");
  const [status, setStatus] = useState("All status");
  const [editing, setEditing] = useState(null);
  // Keep the view and delete dialogs in local component state.
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const rows = menu.filter(
    (m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All categories" || m.category === filter) &&
      (status === "All status" || m.status === status),
  );
  const save = () => {
    if (!editing.name.trim() || Number(editing.price) < 0) {
      notify("Please enter a valid product name and price.", "error");
      return;
    }
    setMenu((old) =>
      editing.id
        ? old.map((x) =>
            x.id === editing.id
              ? { ...editing, price: Number(editing.price) }
              : x,
          )
        : [
            ...old,
            {
              ...editing,
              id: Math.max(0, ...old.map((x) => x.id)) + 1,
              price: Number(editing.price),
              stock: 0,
            },
          ],
    );
    setEditing(null);
    notify("Product saved.", "ok");
  };
  const toggle = (id) =>
    setMenu((old) =>
      old.map((x) =>
        x.id === id
          ? { ...x, status: x.status === "Active" ? "Inactive" : "Active" }
          : x,
      ),
    );
  return (
    <div className="page-content">
      <PageTitle
        title="A menu full of favorites."
        subtitle="Manage your food items, and what's available in the store."
        action={
          <button
            className="primary-btn"
            onClick={() =>
              setEditing({
                name: "",
                category: "Noodles",
                price: "",
                status: "Active",
                stock: 0,
                photo: "",
              })
            }
          >
            <Icon name="plus" /> Add product
          </button>
        }
      />
      <div className="management-layout">
        <section className="panel catalog-panel">
          <div className="catalog-toolbar">
            <label className="field-search">
              <Icon name="search" />
              <input
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <Dropdown
              value={filter}
              options={[
                "All categories",
                ...new Set(menu.map((x) => x.category)),
              ]}
              onChange={setFilter}
            />
            <Dropdown
              value={status}
              options={["All status", "Active", "Inactive"]}
              onChange={setStatus}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>CATEGORY</th>
                  <th>PRICE</th>
                  <th>STOCK</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="product-cell">
                        <img src={photoFor(m)} alt="" />
                        <b>{m.name}</b>
                      </div>
                    </td>
                    <td>{m.category}</td>
                    <td>{peso(m.price)}</td>
                    <td>{m.stock}</td>
                    <td>
                      <button
                        className={`status-pill ${m.status.toLowerCase()}`}
                        onClick={() => toggle(m.id)}
                      >
                        {m.status}
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action"
                          onClick={() => setViewing(m)}
                          aria-label={`View ${m.name}`}
                          title="View"
                        >
                          <Icon name="view" size={16} />
                        </button>
                        <button
                          className="table-action"
                          onClick={() => setEditing({ ...m })}
                          aria-label={`Edit ${m.name}`}
                          title="Edit"
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          className="table-action danger-action"
                          onClick={() => setDeleting(m)}
                          aria-label={`Delete ${m.name}`}
                          title="Delete"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="empty-state">No products match your filters.</div>
            )}
          </div>
        </section>
        {editing && (
          <aside className="panel edit-panel">
            <div className="panel-head">
              <h2>{editing.id ? "Edit product" : "Add product"}</h2>
              <button className="icon-btn" onClick={() => setEditing(null)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="edit-photo">
              <img src={photoFor(editing)} alt="Product preview" />
              <div className="photo-upload-copy">
                <b>
                  {editing.photo ? "Photo selected" : "Product photo"}
                  <small>JPG, PNG or WEBP</small>
                </b>
                <label className="upload-photo-btn">
                  <Icon name="download" size={14} />{" "}
                  {editing.photo ? "Change photo" : "Attach photo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 3 * 1024 * 1024) {
                        notify(
                          "Please choose an image smaller than 3 MB.",
                          "error",
                        );
                        e.target.value = "";
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () =>
                        setEditing((old) => ({ ...old, photo: reader.result }));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
            </div>
            <label>
              Product name
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                placeholder="Enter product name"
              />
            </label>
            <label>
              Category
              <Dropdown
                value={editing.category}
                options={[
                  "Noodles",
                  "Rice Meals",
                  "Snacks",
                  "Toppings",
                  "Drinks",
                  "Desserts",
                  "Sides",
                ]}
                onChange={(v) => setEditing({ ...editing, category: v })}
              />
            </label>
            <div className="form-pair">
              <label>
                Price (PHP)
                <input
                  type="number"
                  min="0"
                  value={editing.price}
                  onChange={(e) =>
                    setEditing({ ...editing, price: e.target.value })
                  }
                />
              </label>
              <label>
                Status
                <Dropdown
                  value={editing.status}
                  options={["Active", "Inactive"]}
                  onChange={(v) => setEditing({ ...editing, status: v })}
                />
              </label>
            </div>
            <div className="edit-actions">
              <button
                className="secondary-btn"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="primary-btn" onClick={save}>
                Save changes
              </button>
            </div>
          </aside>
        )}
        {viewing && (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => setViewing(null)}
          >
            <section
              className="panel item-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Product details"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="panel-head">
                <h2>Product details</h2>
                <button className="icon-btn" onClick={() => setViewing(null)}>
                  <Icon name="close" />
                </button>
              </div>
              <img src={photoFor(viewing)} alt={viewing.name} />
              <h3>{viewing.name}</h3>
              <p>
                {viewing.category} · {peso(viewing.price)}
              </p>
              <p>
                Status: {viewing.status} · Stock: {viewing.stock}
              </p>
            </section>
          </div>
        )}
        {deleting && (
          <div className="modal-backdrop">
            <section
              className="panel confirm-modal"
              role="dialog"
              aria-modal="true"
            >
              <h2>Delete product?</h2>
              <p>
                Are you sure you want to delete {deleting.name}? This action
                cannot be undone.
              </p>
              <div className="edit-actions">
                <button
                  className="secondary-btn"
                  onClick={() => setDeleting(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary-btn danger-btn"
                  onClick={() => {
                    setMenu((old) => old.filter((x) => x.id !== deleting.id));
                    notify("Product deleted.", "ok");
                    setDeleting(null);
                  }}
                >
                  Delete
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
      <div className="tip-card menu-tip">
        <Icon name="alert" />
        <div>
          <b>Tip: Keep your catalog fresh</b>
          <p>
            Update prices, categories, and availability whenever your menu
            changes.
          </p>
        </div>
      </div>
    </div>
  );
}

function Inventory({ stock, setStock, notify }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [adjust, setAdjust] = useState({
    mode: "Stock in",
    product: "",
    quantity: 1,
    note: "",
  });
  const stateOf = (x) =>
    x.stock === 0
      ? "Out of stock"
      : x.stock <= x.threshold
        ? "Low stock"
        : "Available";
  const rows = stock.filter(
    (x) =>
      x.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All statuses" || stateOf(x) === filter),
  );
  const update = () => {
    const amount = Math.max(1, Number(adjust.quantity) || 1);
    if (!adjust.product) {
      notify("Choose an inventory item first.", "error");
      return;
    }
    setStock((old) =>
      old.map((x) =>
        x.id === Number(adjust.product)
          ? {
              ...x,
              stock: Math.max(
                0,
                x.stock + (adjust.mode === "Stock in" ? amount : -amount),
              ),
            }
          : x,
      ),
    );
    notify("Inventory updated.", "ok");
    setAdjust({ ...adjust, quantity: 1, note: "" });
  };
  const available = stock.filter((x) => stateOf(x) === "Available").length,
    low = stock.filter((x) => stateOf(x) === "Low stock").length,
    out = stock.filter((x) => stateOf(x) === "Out of stock").length;
  return (
    <div className="page-content">
      <PageTitle
        title="Ready for the next rush."
        subtitle="Track every pack, portion, and ingredient before it runs out."
      />
      <div className="inventory-stats">
        <Stat
          label="Tracked products"
          value={stock.length}
          hint="Items in inventory"
          icon="inventory"
        />
        <Stat
          label="Available"
          value={available}
          hint="Stock is healthy"
          icon="check"
        />
        <Stat label="Low stock" value={low} hint="Reorder soon" icon="alert" />
        <Stat
          label="Out of stock"
          value={out}
          hint="Needs restocking"
          icon="close"
        />
      </div>
      <div className="management-layout inventory-layout">
        <section className="panel catalog-panel">
          <div className="catalog-toolbar">
            <label className="field-search">
              <Icon name="search" />
              <input
                placeholder="Search inventory..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <Dropdown
              value={filter}
              options={[
                "All statuses",
                "Available",
                "Low stock",
                "Out of stock",
              ]}
              onChange={setFilter}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PRODUCT / CATEGORY</th>
                  <th>ON HAND</th>
                  <th>UNIT</th>
                  <th>REORDER LEVEL</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <b>{x.name}</b>
                      <small className="cell-sub">{x.category}</small>
                    </td>
                    <td
                      className={
                        stateOf(x) !== "Available" ? "stock-warning" : ""
                      }
                    >
                      <b>{x.stock}</b>
                    </td>
                    <td>{x.unit}</td>
                    <td>{x.threshold}</td>
                    <td>
                      <span
                        className={`stock-status ${stateOf(x).toLowerCase().replaceAll(" ", "-")}`}
                      >
                        {stateOf(x)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-action"
                          onClick={() => setViewing(x)}
                          aria-label={`View ${x.name}`}
                          title="View"
                        >
                          <Icon name="view" size={16} />
                        </button>
                        <button
                          className="table-action"
                          onClick={() =>
                            setAdjust({ ...adjust, product: String(x.id) })
                          }
                          aria-label={`Edit ${x.name}`}
                          title="Edit"
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          className="table-action danger-action"
                          onClick={() => setDeleting(x)}
                          aria-label={`Delete ${x.name}`}
                          title="Delete"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {viewing && (
            <div
              className="modal-backdrop"
              role="presentation"
              onClick={() => setViewing(null)}
            >
              <section
                className="panel confirm-modal"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="panel-head">
                  <h2>Inventory details</h2>
                  <button className="icon-btn" onClick={() => setViewing(null)}>
                    <Icon name="close" />
                  </button>
                </div>
                <h3>{viewing.name}</h3>
                <p>{viewing.category}</p>
                <p>
                  On hand: {viewing.stock} {viewing.unit}
                </p>
                <p>Reorder level: {viewing.threshold}</p>
                <p>Status: {stateOf(viewing)}</p>
              </section>
            </div>
          )}
          {deleting && (
            <div className="modal-backdrop">
              <section
                className="panel confirm-modal"
                role="dialog"
                aria-modal="true"
              >
                <h2>Delete inventory item?</h2>
                <p>Are you sure you want to delete {deleting.name}?</p>
                <div className="edit-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => setDeleting(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-btn danger-btn"
                    onClick={() => {
                      setStock((old) =>
                        old.filter((x) => x.id !== deleting.id),
                      );
                      notify("Inventory item deleted.", "ok");
                      setDeleting(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </section>
            </div>
          )}
        </section>
        <aside className="panel edit-panel stock-editor">
          <div className="panel-head">
            <h2>Update stock</h2>
          </div>
          <div className="segmented">
            {["Stock in", "Stock out"].map((x) => (
              <button
                className={adjust.mode === x ? "active" : ""}
                onClick={() => setAdjust({ ...adjust, mode: x })}
                key={x}
              >
                {x}
              </button>
            ))}
          </div>
          <label>
            Product
            <Dropdown
              value={adjust.product}
              placeholder="Select product"
              options={stock.map((x) => ({
                label: x.name,
                value: String(x.id),
              }))}
              onChange={(v) => setAdjust({ ...adjust, product: v })}
            />
          </label>
          <label>
            Quantity to {adjust.mode.toLowerCase()}
            <input
              type="number"
              min="1"
              value={adjust.quantity}
              onChange={(e) =>
                setAdjust({ ...adjust, quantity: e.target.value })
              }
            />
          </label>
          <label>
            Reason / note
            <input
              value={adjust.note}
              onChange={(e) => setAdjust({ ...adjust, note: e.target.value })}
              placeholder="e.g. Delivery received"
            />
          </label>
          <button className="primary-btn full-btn" onClick={update}>
            <Icon name="check" /> Confirm {adjust.mode.toLowerCase()}
          </button>
          <div className="tip-card">
            <Icon name="alert" />
            <div>
              <b>Stock accuracy matters</b>
              <p>
                Record every delivery, usage, or adjustment to keep counts
                reliable.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function orderDateKey(order) {
  const raw =
    order?.created_at ||
    order?.createdAt ||
    order?.transaction_date ||
    order?.date ||
    order?.timestamp;
  if (!raw) return "";
  // Preserve date-only values as entered; timestamps are converted to the user's local date.
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : localDateKey(parsed);
}

function SalesHistory({ orders = [] }) {
  const today = localDateKey();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 6);
  const [period, setPeriod] = useState("Weekly");
  const [start, setStart] = useState(localDateKey(defaultStartDate));
  const [end, setEnd] = useState(today);
  const [appliedStart, setAppliedStart] = useState(
    localDateKey(defaultStartDate),
  );
  const [appliedEnd, setAppliedEnd] = useState(today);
  const [dateError, setDateError] = useState("");
  const [query, setQuery] = useState("");

  const applyDateRange = () => {
    if (!start || !end) {
      setDateError("Please select both a start date and an end date.");
      return;
    }
    if (start > end) {
      setDateError("The start date cannot be later than the end date.");
      return;
    }
    if (end > today) {
      setDateError("The end date cannot be in the future.");
      return;
    }
    setDateError("");
    setAppliedStart(start);
    setAppliedEnd(end);
  };

  // Only actual recorded orders are used here. Undated demo rows cannot be reliably
  // assigned to a selected date range, so they are intentionally excluded.
  const datedOrders = useMemo(
    () =>
      orders
        .map((order) => ({ ...order, _dateKey: orderDateKey(order) }))
        .filter((order) => order._dateKey),
    [orders],
  );
  const rangeOrders = useMemo(
    () =>
      datedOrders.filter(
        (order) =>
          order._dateKey >= appliedStart && order._dateKey <= appliedEnd,
      ),
    [datedOrders, appliedStart, appliedEnd],
  );
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rangeOrders.filter((order) =>
      String(order.id || order.order_number || "")
        .toLowerCase()
        .includes(term),
    );
  }, [rangeOrders, query]);

  const grossSales = rangeOrders.reduce(
    (sum, order) => sum + Number(order.amount ?? order.total ?? 0),
    0,
  );
  const transactionCount = rangeOrders.length;
  const averageOrder = transactionCount ? grossSales / transactionCount : 0;
  const itemsSold = rangeOrders.reduce((sum, order) => {
    if (Array.isArray(order.cart))
      return sum + order.cart.reduce((n, item) => n + Number(item.qty || 0), 0);
    if (Array.isArray(order.items))
      return (
        sum +
        order.items.reduce(
          (n, item) => n + Number(item.qty || item.quantity || 0),
          0,
        )
      );
    return sum + Number(order.item_count || order.quantity || 0);
  }, 0);

  const performance = useMemo(() => {
    const totals = new Map();
    rangeOrders.forEach((order) => {
      const items = Array.isArray(order.cart)
        ? order.cart
        : Array.isArray(order.items)
          ? order.items
          : [];
      items.forEach((item) => {
        const name = item.name || item.product_name || "Menu item";
        const qty = Number(item.qty || item.quantity || 0);
        const sales = Number(item.price || item.unit_price || 0) * qty;
        const current = totals.get(name) || { name, qty: 0, sales: 0 };
        current.qty += qty;
        current.sales += sales;
        totals.set(name, current);
      });
    });
    return [...totals.values()].sort((a, b) => b.sales - a.sales).slice(0, 5);
  }, [rangeOrders]);

  const chart = useMemo(() => {
    const from = new Date(`${appliedStart}T00:00:00`);
    const to = new Date(`${appliedEnd}T00:00:00`);
    const spanDays = Math.max(1, Math.floor((to - from) / 86400000) + 1);
    const bucketCount = Math.min(7, spanDays);
    const values = Array(bucketCount).fill(0);
    const labels = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = Math.floor((i * spanDays) / bucketCount);
      const bucketEnd = Math.floor(((i + 1) * spanDays) / bucketCount) - 1;
      const labelDate = new Date(from);
      labelDate.setDate(labelDate.getDate() + bucketStart);
      if (period === "Monthly")
        return labelDate.toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        });
      if (period === "Daily")
        return labelDate.toLocaleTimeString("en-PH", { hour: "numeric" });
      const endDate = new Date(from);
      endDate.setDate(endDate.getDate() + Math.max(bucketStart, bucketEnd));
      return bucketCount === 1
        ? labelDate.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
          })
        : `${labelDate.getDate()}–${endDate.getDate()}`;
    });
    rangeOrders.forEach((order) => {
      const dayIndex = Math.floor(
        (new Date(`${order._dateKey}T00:00:00`) - from) / 86400000,
      );
      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.floor((dayIndex / spanDays) * bucketCount),
      );
      if (bucketIndex >= 0)
        values[bucketIndex] += Number(order.amount ?? order.total ?? 0);
    });
    return {
      values: values.some((value) => value > 0)
        ? values
        : Array(bucketCount).fill(0),
      labels,
    };
  }, [rangeOrders, appliedStart, appliedEnd, period]);

  return (
    <div className="page-content">
      <PageTitle
        title="The story behind every sale."
        subtitle="See what's selling, when it sells, and how your store is performing."
        action={
          <button className="secondary-btn" onClick={() => window.print()}>
            <Icon name="download" /> Export report
          </button>
        }
      />
      <div className="sales-toolbar">
        <div className="segmented period-tabs">
          {["Daily", "Weekly", "Monthly"].map((p) => (
            <button
              className={period === p ? "active" : ""}
              onClick={() => setPeriod(p)}
              key={p}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="date-filter">
          <input
            aria-label="Start date"
            type="date"
            value={start}
            max={today}
            onChange={(e) => setStart(e.target.value)}
          />
          <span>to</span>
          <input
            aria-label="End date"
            type="date"
            value={end}
            min={start || undefined}
            max={today}
            onChange={(e) => setEnd(e.target.value)}
          />
          <button className="primary-btn" onClick={applyDateRange}>
            Apply
          </button>
        </div>
      </div>
      {dateError && (
        <p className="form-error" role="alert">
          {dateError}
        </p>
      )}
      <div className="sales-range-chip">
        <Icon name="calendar" size={14} />
        <span>
          {new Date(`${appliedStart}T00:00:00`).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
          })}
          {" – "}
          {new Date(`${appliedEnd}T00:00:00`).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="stats-grid sales-stats">
        <Stat
          accent
          label="Gross sales"
          value={peso(grossSales)}
          hint="Recorded sales in selected dates"
          icon="sales"
        />
        <Stat
          label="Transactions"
          value={String(transactionCount)}
          hint="Completed orders in range"
          icon="order"
        />
        <Stat
          label="Average order"
          value={peso(averageOrder)}
          hint="Average transaction value"
          icon="cart"
        />
        <Stat
          label="Items sold"
          value={String(itemsSold)}
          hint="Quantity across recorded orders"
          icon="menu"
        />
      </div>
      <div className="sales-grid">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h2>Sales overview</h2>
              <p>
                {appliedStart} to {appliedEnd}
              </p>
            </div>
            <span className="soft-tag">Total {peso(grossSales)}</span>
          </div>
          <MiniBars
            values={chart.values}
            labels={chart.labels}
            highlight={chart.values.length - 1}
          />
        </section>
        <section className="panel performance">
          <div className="panel-head">
            <h2>Item performance</h2>
            <span className="fire">✦</span>
          </div>
          {performance.length ? (
            performance.map((item) => (
              <div className="performance-row" key={item.name}>
                <div>
                  <b>{item.name}</b>
                  <small>{item.qty} sold</small>
                </div>
                <strong>{peso(item.sales)}</strong>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No item sales recorded in this date range.
            </div>
          )}
        </section>
      </div>
      <section className="panel history-panel">
        <div className="panel-head">
          <div>
            <h2>Transaction history</h2>
            <p>
              {filtered.length} matching transaction
              {filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <label className="field-search compact">
            <Icon name="search" />
            <input
              placeholder="Search transactions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {filtered.length ? (
          <TransactionTable rows={filtered} showDate />
        ) : (
          <div className="empty-state">
            No transactions found between {appliedStart} and {appliedEnd}.
          </div>
        )}
      </section>
    </div>
  );
}

function AccountDetails({ user, notify, avatar, setAvatar }) {
  const [profile, setProfile] = useState({
    fullName: user.fullName || "Demo Owner",
    role: user.role === "OWNER" ? "Owner" : "Staff",
    email: user.email || "",
    phone: user.phone || "",
    store: "Main store",
  });
  const [security, setSecurity] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const fileRef = React.useRef(null);
  const initial = (profile.fullName || profile.email || "A")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Please choose an image file (JPG, PNG or WebP).", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("Profile photo must be under 5 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Centre-crop to a square and shrink so it stays small to store.
        const size = 256,
          side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas
          .getContext("2d")
          .drawImage(
            img,
            (img.width - side) / 2,
            (img.height - side) / 2,
            side,
            side,
            0,
            0,
            size,
            size,
          );
        setAvatar(canvas.toDataURL("image/jpeg", 0.85));
        notify("Profile photo updated.", "ok");
      };
      img.onerror = () => notify("That image could not be read.", "error");
      img.src = reader.result;
    };
    reader.onerror = () => notify("That image could not be read.", "error");
    reader.readAsDataURL(file);
  };
  const removePhoto = () => {
    setAvatar("");
    notify("Profile photo removed.", "info");
  };

  const saveProfile = () => {
    if (
      !profile.fullName.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
    ) {
      notify("Enter a valid name and email address.", "error");
      return;
    }
    notify("Account details saved.", "ok");
  };
  const savePassword = () => {
    if (
      !security.current ||
      security.next.length < 8 ||
      security.next !== security.confirm
    ) {
      notify(
        "Check your current password and ensure the new password is at least 8 characters and matches.",
        "error",
      );
      return;
    }
    notify(
      "Password change validated. Connect the account API to securely update it.",
      "info",
    );
    setSecurity({ current: "", next: "", confirm: "" });
  };
  const passwordInput = (key, label) => (
    <label>
      {label}
      <div className="account-password">
        <input
          type={show[key] ? "text" : "password"}
          value={security[key]}
          onChange={(e) =>
            setSecurity((s) => ({ ...s, [key]: e.target.value }))
          }
          autoComplete="off"
        />
        <button
          type="button"
          aria-label={show[key] ? "Hide password" : "Show password"}
          onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
        >
          <Icon name={show[key] ? "eye-off" : "eye"} />
        </button>
      </div>
    </label>
  );
  return (
    <div className="page-content account-page">
      <PageTitle
        title="Account details"
        subtitle="Manage your profile and store information."
      />
      <div className="account-grid">
        <section className="panel account-form">
          <div className="panel-head">
            <h2>Profile information</h2>
          </div>
          <div className="account-photo">
            <button
              type="button"
              className="account-avatar"
              onClick={() => fileRef.current && fileRef.current.click()}
              aria-label="Change profile photo"
              title="Change profile photo"
            >
              {avatar ? <img src={avatar} alt="Profile" /> : initial}
              <i className="account-avatar-badge">Edit</i>
            </button>
            <div className="account-photo-info">
              <b>{profile.fullName || "Your name"}</b>
              <small>{profile.email}</small>
              <div className="account-photo-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => fileRef.current && fileRef.current.click()}
                >
                  {avatar ? "Change photo" : "Upload photo"}
                </button>
                {avatar && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={removePhoto}
                  >
                    Remove
                  </button>
                )}
              </div>
              <em>JPG, PNG or WebP · up to 5 MB</em>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={onPhoto}
            />
          </div>
          <div className="account-fields">
            <label>
              Full Name
              <input
                value={profile.fullName}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, fullName: e.target.value }))
                }
              />
            </label>
            <label>
              Role / Title
              <input
                value={profile.role}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, role: e.target.value }))
                }
              />
            </label>
            <label>
              Email Address
              <input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, email: e.target.value }))
                }
              />
            </label>
            <label>
              Phone Number
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="Add phone number"
              />
            </label>
            <label>
              Store / Branch
              <input
                value={profile.store}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, store: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="account-actions">
            <button className="primary-btn" onClick={saveProfile}>
              Save details
            </button>
          </div>
        </section>
        <section className="panel account-form">
          <div className="panel-head">
            <h2>Password &amp; Security</h2>
          </div>
          <div className="account-fields account-fields-single">
            {passwordInput("current", "Current password")}
            {passwordInput("next", "New password")}
            {passwordInput("confirm", "Confirm new password")}
          </div>
          <div className="account-actions">
            <button className="primary-btn" onClick={savePassword}>
              Update password
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Shell({ user, onLogout, notify }) {
  const [page, setPage] = useState("dashboard");
  const [menu, setMenu] = useState(initialMenu);
  const [stock, setStock] = useState(initialStock);
  const [orders, setOrders] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotice, setReadNotice] = useState(false);
  const avatarKey = `pj_avatar_${user.id || user.email || "user"}`;
  const [avatar, setAvatarState] = useState(() => {
    try {
      return localStorage.getItem(avatarKey) || "";
    } catch {
      return "";
    }
  });
  const setAvatar = (v) => {
    setAvatarState(v);
    try {
      v
        ? localStorage.setItem(avatarKey, v)
        : localStorage.removeItem(avatarKey);
    } catch {}
  };
  const isOwner = user.role === "OWNER";
  const nav = [
    ...(isOwner
      ? [{ id: "dashboard", label: "Dashboard", icon: "dashboard" }]
      : []),
    { id: "order", label: "New order", icon: "order" },
    ...(isOwner
      ? [
          { id: "menu", label: "Menu management", icon: "menu" },
          { id: "inventory", label: "Inventory", icon: "inventory" },
          { id: "sales", label: "Sales & history", icon: "sales" },
        ]
      : [{ id: "sales", label: "Sales & history", icon: "sales" }]),
  ];
  const title =
    page === "account"
      ? "Account details"
      : nav.find((x) => x.id === page)?.label || "Dashboard";
  const initials = (user.fullName || "A").slice(0, 1).toUpperCase();
  return (
    <div className="pojang-app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/img/logo.jpg" alt="Pojangmacha" />
          <div>
            <b>POJANGMACHA</b>
            <small>AUTHENTIC KOREAN STREET FOOD</small>
          </div>
        </div>
        <nav className="workspace-nav" aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => setPage(n.id)}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="app-main">
        <header className="app-topbar">
          <div className="breadcrumb">
            <span>Main store</span>
            <b>/</b>
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <div className="notification-wrap">
              <button
                className={`icon-btn notification-btn ${notificationsOpen ? "is-open" : ""}`}
                title="Notifications"
                aria-label="Notifications"
                onClick={() => {
                  setNotificationsOpen((v) => !v);
                  setProfileOpen(false);
                }}
              >
                <Icon name="bell" />
                {!readNotice && <i className="notification-dot" />}
              </button>
              {notificationsOpen && (
                <div className="notification-dropdown">
                  <div className="dropdown-heading">
                    <b>Notifications</b>
                    <button onClick={() => setReadNotice(true)}>
                      Mark all read
                    </button>
                  </div>
                  <button
                    className={`notice-item ${readNotice ? "read" : "unread"}`}
                    onClick={() => {
                      setReadNotice(true);
                      setNotificationsOpen(false);
                      setPage("inventory");
                    }}
                  >
                    <span className="notice-icon">
                      <Icon name="alert" size={16} />
                    </span>
                    <span>
                      <b>Low stock alert</b>
                      <small>
                        Leche Flan is running low. Review your inventory.
                      </small>
                      <small className="notice-time">
                        Just now · Click to view inventory
                      </small>
                    </span>
                  </button>
                  <div className="notification-footer">
                    <button
                      onClick={() => {
                        setReadNotice(true);
                        setNotificationsOpen(false);
                        setPage("inventory");
                      }}
                    >
                      View inventory
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="profile-menu">
              <button
                className="profile-trigger"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
                aria-expanded={profileOpen}
              >
                <span>{avatar ? <img src={avatar} alt="" /> : initials}</span>
                <b>
                  {user.fullName || "Administrator"}
                  <small>{isOwner ? "Owner" : "Cashier"}</small>
                </b>
                <Icon name="down" size={15} />
              </button>
              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-head">
                    <span>
                      {avatar ? <img src={avatar} alt="" /> : initials}
                    </span>
                    <div>
                      <b>{user.fullName || "Administrator"}</b>
                      <small>{isOwner ? "Owner" : "Cashier"}</small>
                    </div>
                  </div>
                  <div className="profile-email">{user.email}</div>
                  <div className="dropdown-divider" />
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setPage("account");
                    }}
                  >
                    <Icon name="edit" size={16} /> Account details
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setNotificationsOpen(true);
                    }}
                  >
                    <Icon name="bell" size={16} /> Notifications
                  </button>
                  <div className="dropdown-divider" />
                  <button className="logout-option" onClick={onLogout}>
                    <Icon name="logout" size={16} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {page === "dashboard" && (
          <Dashboard menu={menu} orders={orders} setPage={setPage} />
        )}
        {page === "order" && (
          <POSPage
            menu={menu}
            setMenu={setMenu}
            notify={notify}
            onOrder={(o) => setOrders((old) => [o, ...old])}
          />
        )}
        {page === "menu" && (
          <MenuManagement menu={menu} setMenu={setMenu} notify={notify} />
        )}
        {page === "inventory" && (
          <Inventory stock={stock} setStock={setStock} notify={notify} />
        )}
        {page === "sales" && <SalesHistory orders={orders} />}
        {page === "account" && (
          <AccountDetails
            user={user}
            notify={notify}
            avatar={avatar}
            setAvatar={setAvatar}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((msg, kind = "info") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem("pj_token");
    setUser(null);
  }, []);
  useEffect(() => {
    if (getToken())
      api("/auth/me")
        .then(setUser)
        .catch(() => localStorage.removeItem("pj_token"))
        .finally(() => setReady(true));
    const h = () => {
      setUser(null);
      notify("Your session expired. Log in again.", "error");
    };
    window.addEventListener("pj-logout", h);
    return () => window.removeEventListener("pj-logout", h);
  }, [notify]);
  return (
    <>
      {!ready ? (
        <div className="boot">
          <img src="/img/logo.jpg" alt="" />
        </div>
      ) : user ? (
        <Shell user={user} onLogout={logout} notify={notify} />
      ) : (
        <Auth onAuth={setUser} notify={notify} />
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
