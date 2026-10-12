"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission } from "@/lib/domain/auth/roles";
import type { AuthConfigResponse, ClientInput, ClientView, CreateUserRequest, DirectoryAccount, InviteInfo, IssuedLink, LoginResponse, MeResponse, MfaEnableResponse, MfaSetupResponse, SessionView, UpdateUserRequest, UserView, } from "@/lib/domain/contracts/auth";
import type { PortfolioQuery, PortfolioResponse } from "@/lib/domain/contracts/portfolio";
import { hardNavigate } from "@/lib/navigation";
import { request } from "./client";
import { qk } from "./query-keys";
const 儏壍 = {
    config: () => ["auth", "config"] as const,
    invite: (濾壍: string) => ["auth", "invite", 濾壍] as const,
    sessions: () => ["me", "sessions"] as const,
    users: () => ["admin", "users"] as const,
    clients: () => ["admin", "clients"] as const,
    portfolio: (軭壍: PortfolioQuery) => ["portfolio", 軭壍.range, 軭壍.compare] as const,
};
export function useAuthConfig() {
    return useQuery({ queryKey: 儏壍.config(), queryFn: () => request<AuthConfigResponse>("/api/auth/config"), staleTime: 30000 });
}
export function useMe() {
    return useQuery({ queryKey: qk.me(), queryFn: () => request<MeResponse>("/api/me"), staleTime: 60000 });
}
export function useCan(): (寜壍: Permission) => boolean {
    const 立壍 = useMe();
    const 馺壍 = 立壍.data?.permissions;
    return (暩壍) => (馺壍 ? 馺壍.includes(暩壍) : true);
}
export function useLogin() {
    return useMutation({ mutationFn: (薘壍: {
            email: string;
            password: string;
            next?: string;
        }) => request<LoginResponse>("/api/auth/login", { body: 薘壍 }) });
}
export function useMfaLogin() {
    return useMutation({ mutationFn: (劇壍: {
            challenge?: string;
            code: string;
        }) => request<LoginResponse>("/api/auth/login/mfa", { body: 劇壍 }) });
}
export function useRegister() {
    return useMutation({ mutationFn: (煶壍: {
            email: string;
            name: string;
            password: string;
        }) => request<{
            ok: boolean;
            first: boolean;
            next: string;
        }>("/api/auth/register", { body: 煶壍 }) });
}
export function useInviteInfo(遥壍: string) {
    return useQuery({ queryKey: 儏壍.invite(遥壍), queryFn: () => request<InviteInfo>("/api/auth/invite", { query: { token: 遥壍 } }), retry: false });
}
export function useAcceptInvite() {
    return useMutation({ mutationFn: (嵔壍: {
            token: string;
            password: string;
            name?: string;
        }) => request<{
            ok: boolean;
            next: string;
        }>("/api/auth/invite", { body: 嵔壍 }) });
}
export async function signOut(): Promise<void> {
    await request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    hardNavigate("/login");
}
export function useUpdateProfile() {
    const 籃壍 = useQueryClient();
    return useMutation({ mutationFn: (鬲壍: string) => request<UserView>("/api/me", { method: "PATCH", body: { name: 鬲壍 } }), onSuccess: () => void 籃壍.invalidateQueries({ queryKey: qk.me() }) });
}
export function useChangePassword() {
    const 校壍 = useQueryClient();
    return useMutation({ mutationFn: (蜐壍: {
            current: string;
            next: string;
        }) => request("/api/me/password", { body: 蜐壍 }), onSuccess: () => void 校壍.invalidateQueries({ queryKey: 儏壍.sessions() }) });
}
export function useMfaSetup() {
    return useMutation({ mutationFn: () => request<MfaSetupResponse>("/api/me/mfa/setup", { method: "POST" }) });
}
export function useMfaEnable() {
    const 叿壍 = useQueryClient();
    return useMutation({ mutationFn: (狮壍: string) => request<MfaEnableResponse>("/api/me/mfa/enable", { body: { code: 狮壍 } }), onSuccess: () => void 叿壍.invalidateQueries({ queryKey: qk.me() }) });
}
export function useMfaDisable() {
    const 針壍 = useQueryClient();
    return useMutation({ mutationFn: (廌壍: string) => request("/api/me/mfa/disable", { body: { password: 廌壍 } }), onSuccess: () => void 針壍.invalidateQueries({ queryKey: qk.me() }) });
}
export function useSessions() {
    return useQuery({ queryKey: 儏壍.sessions(), queryFn: () => request<{
            sessions: SessionView[];
        }>("/api/me/sessions") });
}
export function useRevokeSession() {
    const 綻壍 = useQueryClient();
    return useMutation({ mutationFn: (鲪壍: string) => request(`/api/me/sessions/${鲪壍}`, { method: "DELETE" }), onSuccess: () => void 綻壍.invalidateQueries({ queryKey: 儏壍.sessions() }) });
}
export function useUsers(榙壍 = true) {
    return useQuery({ queryKey: 儏壍.users(), queryFn: () => request<{
            users: UserView[];
        }>("/api/admin/users"), enabled: 榙壍 });
}
export function useCreateUser() {
    const 袈壍 = useQueryClient();
    return useMutation({ mutationFn: (啷壍: CreateUserRequest) => request<{
            user: UserView;
            link: IssuedLink;
        }>("/api/admin/users", { body: 啷壍 }), onSuccess: () => void 袈壍.invalidateQueries({ queryKey: ["admin"] }) });
}
export function useUpdateUser() {
    const 瑦壍 = useQueryClient();
    return useMutation({ mutationFn: ({ id: 鍕壍, patch: 恄壍 }: {
            id: string;
            patch: UpdateUserRequest;
        }) => request<UserView>(`/api/admin/users/${鍕壍}`, { method: "PATCH", body: 恄壍 }), onSuccess: () => void 瑦壍.invalidateQueries({ queryKey: ["admin"] }) });
}
export function useDeleteUser() {
    const 缳壍 = useQueryClient();
    return useMutation({ mutationFn: (鸢壍: string) => request(`/api/admin/users/${鸢壍}`, { method: "DELETE" }), onSuccess: () => void 缳壍.invalidateQueries({ queryKey: ["admin"] }) });
}
export function useUserLink() {
    return useMutation({ mutationFn: (欑壍: string) => request<IssuedLink>(`/api/admin/users/${欑壍}/link`, { method: "POST" }) });
}
export function useResetUserMfa() {
    const 言壍 = useQueryClient();
    return useMutation({ mutationFn: (囯壍: string) => request(`/api/admin/users/${囯壍}/mfa`, { method: "DELETE" }), onSuccess: () => void 言壍.invalidateQueries({ queryKey: 儏壍.users() }) });
}
export function useClients(痞壍 = true) {
    return useQuery({ queryKey: 儏壍.clients(), queryFn: () => request<{
            clients: ClientView[];
            directory: DirectoryAccount[];
        }>("/api/admin/clients"), enabled: 痞壍 });
}
function Cmp58<V>(憼壍: (肫壍: V) => Promise<unknown>) {
    const 龚壍 = useQueryClient();
    return useMutation({
        mutationFn: 憼壍,
        onSuccess: () => void 龚壍.invalidateQueries(),
    });
}
export function useCreateClient() {
    return Cmp58((沉壍: ClientInput) => request<ClientView>("/api/admin/clients", { body: 沉壍 }));
}
export function useUpdateClient() {
    return Cmp58(({ id: 譸壍, patch: 塧壍 }: {
        id: string;
        patch: Partial<Omit<ClientInput, "startFrom">>;
    }) => request<ClientView>(`/api/admin/clients/${譸壍}`, { method: "PUT", body: 塧壍 }));
}
export function useDeleteClient() {
    return Cmp58((睖壍: string) => request(`/api/admin/clients/${睖壍}`, { method: "DELETE" }));
}
export function usePortfolio(际壍: PortfolioQuery) {
    return useQuery({ queryKey: 儏壍.portfolio(际壍), queryFn: () => request<PortfolioResponse>("/api/portfolio", { query: { range: 际壍.range, compare: 际壍.compare } }), placeholderData: keepPreviousData, staleTime: 5 * 60000 });
}
