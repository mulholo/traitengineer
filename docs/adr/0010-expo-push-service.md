# 0010. Expo push service

- Status: accepted
- Date: 2026-10-14

## Context

Push to iOS (and later Android) without managing APNs/FCM directly.

## Decision

`expo-server-sdk` sends via Expo's push service; receipts are polled to disable dead tokens.

## Alternatives considered

Direct APNs (more credential handling); OneSignal (third party, cost).
