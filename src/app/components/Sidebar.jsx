"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CreditCard,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Rocket,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useSubscription } from "@/app/hooks/useSubscription";
import { legacyConversationTitle } from "@/app/lib/conversationTitles";
import Logo from "@/app/components/Logo";

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const COLLAPSED_WIDTH = 52;

function getDisplayTitle(conversation) {
  const title = typeof conversation?.title === "string" ? conversation.title.trim() : "";
  if (title) return title;

  const firstUserMessage = (conversation?.messages || [])
    .filter((message) => message.role === "user")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

  return legacyConversationTitle(firstUserMessage?.content);
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRenameId, setSavingRenameId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState([]);
  const [lastPathname, setLastPathname] = useState(pathname);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  const draggingRef = useRef(false);
  const menuRef = useRef(null);
  const { plan, isPaid, openBillingPortal } = useSubscription();

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      `${collapsed ? COLLAPSED_WIDTH : width}px`
    );
  }, [collapsed, width]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent) => {
      if (!draggingRef.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, moveEvent.clientX));
      setWidth(next);
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const refetchConversations = useCallback(async (userId) => {
    if (!userId) {
      setConversations([]);
      return;
    }

    const { data } = await supabase
      .from("conversations")
      .select("id, title, updated_at, messages(role, content, created_at)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(30);

    setConversations((data || []).map((conversation) => ({
      ...conversation,
      title: getDisplayTitle(conversation),
    })));
  }, []);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
    setConversationMenuOpen(null);
    setMenuOpen(false);
    setOpeningPortal(false);
    refetchConversations(user?.id);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
      refetchConversations(data.user?.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
      refetchConversations(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, [refetchConversations]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }

      if (!e.target.closest("[data-conversation-menu]")) {
        setConversationMenuOpen(null);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const logout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
    setMenuOpen(false);
    router.push("/");
  };

  const deleteConversation = async (conversationId) => {
    if (deletingId) return;

    const confirmed = window.confirm("¿Eliminar esta conversación?");
    if (!confirmed) return;

    setDeletingId(conversationId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No hay sesión activa.");
      }

      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("No se pudo eliminar la conversación.");
      }

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      if (pathname === `/chat/${conversationId}`) {
        router.push("/");
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar la conversación.");
    } finally {
      setDeletingId(null);
      setConversationMenuOpen(null);
    }
  };

  const startRename = (conversation) => {
    setConversationMenuOpen(null);
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
    setSavingRenameId(null);
  };

  const saveRename = async (conversationId) => {
    if (savingRenameId) return;

    const conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation) return cancelRename();

    const nextTitle = renameValue.trim().slice(0, 100);
    if (!nextTitle || nextTitle === conversation.title) {
      cancelRename();
      return;
    }

    setSavingRenameId(conversationId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No hay sesión activa.");
      }

      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: nextTitle }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "No se pudo renombrar la conversación.");
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title: json.conversation.title } : c))
      );

      window.dispatchEvent(
        new CustomEvent("askly:conversation-renamed", {
          detail: { id: conversationId, title: json.conversation.title },
        })
      );

      cancelRename();
    } catch (error) {
      console.error(error);
      cancelRename();
    }
  };

  const handleManage = async (e) => {
    e.preventDefault();
    setMenuOpen(false);

    if (openingPortal) return;

    setOpeningPortal(true);

    try {
      await openBillingPortal();
    } catch (err) {
      console.error(err);
    } finally {
      setOpeningPortal(false);
    }
  };

  const displayName =
    user?.user_metadata?.full_name?.trim() || user?.email?.split("@")[0] || "Usuario";

  const initials = displayName.slice(0, 2).toUpperCase();

  const filteredConversations = search.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.trim().toLowerCase())
      )
    : conversations;

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        className={`fixed left-4 top-4 z-40 grid size-9 place-items-center rounded-xl border border-white/[0.07] bg-transparent text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/[0.03] hover:text-[var(--foreground)] lg:hidden ${
          mobileOpen ? "hidden" : ""
        }`}
      >
        <Menu className="size-5" />
      </button>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col border-r border-white/[0.035] bg-[var(--sidebar)] transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:w-[var(--sidebar-w)] lg:translate-x-0`}
      >
        <div
          className={`flex items-center justify-between px-4 py-4 ${
            collapsed ? "lg:flex-col lg:justify-start lg:gap-5 lg:px-0 lg:py-5" : ""
          }`}
        >
          <Link
            href="/"
            className={`flex items-center gap-2 text-sm tracking-tight text-[var(--foreground)] ${
              collapsed ? "lg:justify-center lg:opacity-85" : ""
            }`}
          >
            <Logo size={collapsed ? 26 : 34} />
            {!collapsed && (
              <span className="font-[family-name:var(--font-display)] font-medium lg:inline">
                Askly
              </span>
            )}
          </Link>

          <div className={`items-center gap-1 ${collapsed ? "hidden lg:hidden" : "flex"}`}>
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Buscar conversaciones"
              className="grid size-8 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              <Search className="size-4" />
            </button>

            <button
              onClick={() => setCollapsed(true)}
              aria-label="Colapsar sidebar"
              className="hidden size-8 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] lg:grid"
            >
              <PanelLeftClose className="size-4" />
            </button>

            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="grid size-8 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Expandir sidebar"
              className="hidden size-8 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/[0.025] hover:text-[var(--foreground)] lg:grid"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="px-3">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                router.push("/");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/[0.025] hover:text-[var(--foreground)]"
              aria-label="Nueva conversación"
              title="Nueva conversación"
            >
              <PenLine className="size-4 shrink-0" />
              <span>Nueva conversación</span>
            </button>
          </div>
        )}

        {!collapsed && searchOpen && (
          <div className="px-3 pt-3">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversaciones..."
              className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-secondary)] focus:outline-none"
            />
          </div>
        )}

        <div className="mt-4 flex-1 overflow-y-auto px-3">
          {!collapsed && (
            <>
              <p className="px-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Conversaciones
              </p>

              {filteredConversations.length === 0 ? (
                <div className="mt-2 rounded-xl border border-dashed border-white/[0.06] px-3 py-6 text-center text-xs text-[var(--text-secondary)]">
                  {user
                    ? search
                      ? "Sin resultados."
                      : "Aún no tienes conversaciones guardadas."
                    : "Inicia sesión para ver tu historial."}
                </div>
              ) : (
                <ul className="mt-2 space-y-0.5">
                  {filteredConversations.map((c) => {
                    const href = `/chat/${c.id}`;
                    const active = pathname === href;

                    return (
                      <li key={c.id} className="relative" data-conversation-menu>
                        <div
                          className={`group relative flex items-center rounded-lg border-l-2 transition-colors duration-200 ${
                            active
                              ? "border-[var(--accent)] bg-white/[0.04] text-[var(--foreground)]"
                              : "border-transparent text-[var(--text-secondary)] hover:bg-white/[0.025] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {renamingId === c.id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              maxLength={100}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onBlur={() => saveRename(c.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelRename();
                                }
                              }}
                              disabled={savingRenameId === c.id}
                              className="min-w-0 max-w-[calc(100%-44px)] flex-1 bg-transparent py-2 pl-2.5 pr-2 text-sm text-[var(--foreground)] outline-none disabled:opacity-70"
                              aria-label="Renombrar conversación"
                            />
                          ) : (
                            <Link
                              href={href}
                              onClick={() => setMobileOpen(false)}
                              className="min-w-0 max-w-[calc(100%-44px)] flex-1 truncate py-2 pl-2.5 pr-2 text-sm"
                              title={c.title}
                            >
                              {c.title}
                            </Link>
                          )}

                          {renamingId !== c.id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setConversationMenuOpen((open) =>
                                  open === c.id ? null : c.id
                                );
                              }}
                              className={`absolute right-1 grid size-7 place-items-center rounded-md text-[var(--text-secondary)] transition-opacity hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus:opacity-100 ${
                                conversationMenuOpen === c.id
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100"
                              }`}
                              aria-label="Opciones de conversación"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          )}
                        </div>

                        {conversationMenuOpen === c.id && (
                          <div className="absolute right-1 top-9 z-50 w-44 overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--background)]">
                            <button
                              type="button"
                              onClick={() => startRename(c)}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                            >
                              <PenLine className="size-4" />
                              Renombrar
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === c.id}
                              onClick={() => deleteConversation(c.id)}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300/80 transition-colors duration-200 hover:bg-[var(--surface-hover)] disabled:opacity-50"
                            >
                              <Trash2 className="size-4" />
                              {deletingId === c.id ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <div className={`${collapsed ? "border-t-0 p-0 pb-4" : "border-t border-white/[0.06] p-3"}`}>
          {!user ? (
            <div className="space-y-2">
              <Link
                href="/login"
                aria-label="Iniciar sesión"
                title="Iniciar sesión"
                className={`flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors duration-200 hover:bg-[var(--surface-hover)] ${
                  collapsed ? "lg:border-0 lg:px-0 lg:py-2" : ""
                }`}
              >
                {collapsed ? <LogIn className="size-5" /> : "Iniciar sesión"}
              </Link>

              {!collapsed && (
                <Link
                  href="/register"
                  className="flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-[var(--on-accent)] transition-colors duration-200 hover:bg-[var(--accent-hover)]"
                >
                  Crear cuenta
                </Link>
              )}
            </div>
          ) : (
            <div className="relative" ref={menuRef}>
              {menuOpen && (
                <div
                  className={`absolute bottom-full left-0 mb-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--background)] ${
                    collapsed ? "w-full" : "w-full"
                  }`}
                >
                  <Link
                    href="/pricing"
                    onClick={() => setMenuOpen(false)}
                    title="Plan"
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] ${
                      collapsed ? "justify-center px-0" : "text-left"
                    }`}
                  >
                    <Rocket className="size-4 shrink-0" />
                    {!collapsed && <span>Plan</span>}
                  </Link>

                  {isPaid && (
                    <button
                      onClick={handleManage}
                      disabled={openingPortal}
                      title="Facturación"
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50 ${
                        collapsed ? "justify-center px-0" : "text-left"
                      }`}
                    >
                      <CreditCard className="size-4 shrink-0" />
                      {!collapsed && (
                        <span>{openingPortal ? "Abriendo..." : "Facturación"}</span>
                      )}
                    </button>
                  )}

                  <div className="h-px bg-[var(--border)]" />

                  <button
                    onClick={logout}
                    disabled={loggingOut}
                    title="Cerrar sesión"
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-300/80 transition-colors duration-200 hover:bg-[var(--surface-hover)] disabled:opacity-50 ${
                      collapsed ? "justify-center px-0" : "text-left"
                    }`}
                  >
                    <LogOut className="size-4 shrink-0" />
                    {!collapsed && <span>{loggingOut ? "Saliendo..." : "Cerrar sesión"}</span>}
                  </button>
                </div>
              )}

              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors duration-200 hover:bg-[var(--surface-hover)] ${
                  collapsed ? "lg:justify-center lg:rounded-none lg:px-0 lg:py-0 lg:hover:bg-transparent" : ""
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-medium text-[var(--foreground)] ${
                    collapsed ? "border-0 bg-transparent" : "border border-white/[0.08] bg-white/[0.03]"
                  }`}
                >
                  {initials}
                </span>

                {!collapsed && (
                  <span className="min-w-0 flex-1 lg:block">
                    <span className="truncate text-sm font-medium text-[var(--foreground)]">
                      {displayName}
                    </span>
                    <span className="block truncate text-xs text-[var(--text-secondary)]">
                      Plan {plan.label}
                    </span>
                  </span>
                )}

                {!collapsed && (
                  <ChevronDown className="size-4 shrink-0 text-[var(--text-secondary)] lg:block" />
                )}
              </button>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            type="button"
            aria-hidden="true"
            onMouseDown={handleResizeStart}
            className="absolute right-0 top-0 hidden h-full w-1 cursor-col-resize lg:block"
          />
        )}
      </aside>
    </>
  );
}
