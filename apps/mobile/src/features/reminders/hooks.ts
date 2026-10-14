import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@te/client";
import { api, unwrap } from "../../api/client";
import { keys } from "../../api/keys";

export type Reminder = Schemas["Reminder"];
export type Schedule = Schemas["ReminderSchedule"];

export function useReminders() {
  return useQuery({ queryKey: keys.reminders, queryFn: () => unwrap(api.GET("/v1/reminders")) });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: keys.reminders });
}

export function useCreateReminder() {
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: (body: Schemas["CreateReminder"]) => unwrap(api.POST("/v1/reminders", { body })),
    onSuccess,
  });
}

export function useUpdateReminder() {
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas["UpdateReminder"] }) =>
      unwrap(api.PATCH("/v1/reminders/{id}", { params: { path: { id } }, body })),
    onSuccess,
  });
}

export function useDeleteReminder() {
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/v1/reminders/{id}", { params: { path: { id } } })),
    onSuccess,
  });
}

export function useSendTestReminder() {
  return useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/v1/reminders/{id}/test", { params: { path: { id } } })),
  });
}

/** Human-readable description of a schedule preset. */
export function describeSchedule(s: Schedule): string {
  switch (s.type) {
    case "daily":
      return `Every day at ${s.time}`;
    case "weekdays":
      return `Weekdays at ${s.time}`;
    case "every_n_hours":
      return `Every ${s.everyHours}h from ${s.start} to ${s.end}`;
  }
}
