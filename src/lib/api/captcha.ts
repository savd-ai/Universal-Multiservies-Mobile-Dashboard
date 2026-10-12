"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CaptchaStatus, CaptchaVerifyBody } from "@/lib/domain/contracts/captcha";
import { request } from "./client";
import { qk } from "./query-keys";

export function useCaptcha() {
  return useQuery({
    queryKey: qk.captcha(),
    queryFn: ({ signal }) => request<CaptchaStatus>("/api/captcha", { signal }),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useCaptchaVerify() {
  return useMutation({
    mutationFn: (body: CaptchaVerifyBody) => request<{ ok: true; moves: number }>("/api/captcha", { body }),
  });
}
