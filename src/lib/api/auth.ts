"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission } from "@/lib/domain/auth/roles";
import type { AuthConfigResponse, ClientInput, ClientView, CreateUserRequest, DirectoryAccount, InviteInfo, IssuedLink, LoginResponse, MeResponse, MfaEnableResponse, MfaSetupResponse, SessionView, UpdateUserRequest, UserView, } from "@/lib/domain/contracts/auth";
import type { PortfolioQuery, PortfolioResponse } from "@/lib/domain/contracts/portfolio";
import { hardNavigate } from "@/lib/navigation";
import { request } from "./client";
import { qk } from "./query-keys";
const authKeys = {
    config: () => ["auth", "config"] as const,
    invite: (token: string) => ["auth", "invite", token] as const,
    sessions: () => ["me", "sessions"] as const,
    users: () => ["admin", "users"] as const,
    clients: () => ["admin", "clients"] as const,
    portfolio: (q: PortfolioQuery) => ["portfolio", q.range, q.compare] as const,
};
export function useAuthConfig() {
    return useQuery({ queryKey: authKeys.config(), queryFn: () => request<AuthConfigResponse>("/api/auth/config"), staleTime: 30000 });
}
export function useMe() {
    return useQuery({ queryKey: qk.me(), queryFn: () => request<MeResponse>("/api/me"), staleTime: 60000 });
}
export function useCan(): (permission: Permission) => boolean {
    const me = useMe();
    const perms = me.data?.permissions;
    return (permission) => (perms ? perms.includes(permission) : true);
}
export function useLogin() {
    return useMutation({ mutationFn: (body: {
            email: string;
            password: string;
            next?: string;
        }) => request<LoginResponse>("/api/auth/login", { body }) });
}
export function useMfaLogin() {
    return useMutation({ mutationFn: (body: {
            challenge?: string;
            code: string;
        }) => request<LoginResponse>("/api/auth/login/mfa", { body }) });
}
export function useRegister() {
    return useMutation({ mutationFn: (body: {
            email: string;
            name: string;
            password: string;
            setupCode?: string;
        }) => request<{
            ok: boolean;
            first: boolean;
            next: string;
        }>("/api/auth/register", { body }) });
}
export function useInviteInfo(token: string) {
    return useQuery({ queryKey: authKeys.invite(token), queryFn: () => request<InviteInfo>("/api/auth/invite", { query: { token } }), retry: false });
}
export function useAcceptInvite() {
    return useMutation({ mutationFn: (body: {
            token: string;
            password: string;
            name?: string;
        }) => request<{
            ok: boolean;
            next: string;
        }>("/api/auth/invite", { body }) });
}
export async function signOut(): Promise<void> {
    await request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    hardNavigate("/login");
}
export function useUpdateProfile() {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (name: string) => request<UserView>("/api/me", { method: "PATCH", body: { name } }), onSuccess: () => void qc.invalidateQueries({ queryKey: qk.me() }) });
}
export function useChangePassword() {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: {
            current: string;
            next: string;
        }) => request("/api/me/password", { body }), onSuccess: () => void qc.invalidateQueries({ queryKey: authKeys.sessions() }) });
}
export function useMfaSetup() {
    return useMutation({ mutationFn: () => request<MfaSetupResponse>("/api/me/mfa/setup", { method: "POST" }) });
}
export function useMfaEnable() {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (code: string) => request<MfaEnableResponse>("/api/me/mfa/enable", { body: { code } }), onSuccess: () => void qc.invalidateQueries({ queryKey: qk.me() }) });
}
export function useMfaDisable() {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (password: string) => request("/api/me/mfa/disable", { body: { password } }), onSuccess: () => void qc.invalidateQueries({ queryKey: qk.me() }) });
}
export function useSessions() {
    return useQuery({ queryKey: authKeys.sessions(), queryFn: () => request<{
            sessions: SessionView[];
        }>("/api/me/sessions") });
}
export function useRevokeSession() {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (id: string) => request(`/api/me/sessions/${id}`, { method: "DELETE" }), onSuccess: () => void qc.invalidateQueries({ queryKey: authKeys.sessions() }) });
}
export function useUsers(enabled = true) {
    return useQuery({ queryKey: authKeys.users(), queryFn: () => request<{
            users: UserView[];
        }>("/api/admin/users"), enabled });
}
export function useCreateUser() {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: CreateUserRequest) => request<{
            user: UserView;
            link: IssuedLink;
        }>("/api/admin/users", { body }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin"] }) });
}
export function useUpdateUser() {
    const qc = useQueryClient();
    return useMutation({ mutationFn: ({ id, patch }: {
            id: string;
            patch: UpdateUserRequest;
        }) => request<UserView>(`/api/admin/users/${id}`, { method: "PATCH", body: patch }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin"] }) });
}
export function useDeleteUser() {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (id: string) => request(`/api/admin/users/${id}`, { method: "DELETE" }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin"] }) });
}
export function useUserLink() {
    return useMutation({ mutationFn: (id: string) => request<IssuedLink>(`/api/admin/users/${id}/link`, { method: "POST" }) });
}
export function useResetUserMfa() {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (id: string) => request(`/api/admin/users/${id}/mfa`, { method: "DELETE" }), onSuccess: () => void qc.invalidateQueries({ queryKey: authKeys.users() }) });
}
export function useClients(enabled = true) {
    return useQuery({ queryKey: authKeys.clients(), queryFn: () => request<{
            clients: ClientView[];
            directory: DirectoryAccount[];
        }>("/api/admin/clients"), enabled });
}
function useClientMutation<V>(fn: (v: V) => Promise<unknown>) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => void qc.invalidateQueries(),
    });
}
export function useCreateClient() {
    return useClientMutation((body: ClientInput) => request<ClientView>("/api/admin/clients", { body }));
}
export function useUpdateClient() {
    return useClientMutation(({ id, patch }: {
        id: string;
        patch: Partial<Omit<ClientInput, "startFrom">>;
    }) => request<ClientView>(`/api/admin/clients/${id}`, { method: "PUT", body: patch }));
}
export function useDeleteClient() {
    return useClientMutation((id: string) => request(`/api/admin/clients/${id}`, { method: "DELETE" }));
}
export function usePortfolio(q: PortfolioQuery) {
    return useQuery({ queryKey: authKeys.portfolio(q), queryFn: () => request<PortfolioResponse>("/api/portfolio", { query: { range: q.range, compare: q.compare } }), placeholderData: keepPreviousData, staleTime: 5 * 60000 });
}
