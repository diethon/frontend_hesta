# Shared frontend realtime

HESTA has one frontend realtime transport. Feature pages, including a future Digital Twin, must
not create another `WebSocket` or STOMP client.

```text
Backend event
    |
    v
shared realtime client
    |
    v
central event dispatcher
    |
    v
feature Redux action / feature handler
```

## Connection and authentication

`RealtimeLifecycle` is mounted once next to the router. It reads the existing access token from
the Redux authentication state and coordinates the singleton `realtimeClient`. The client connects
to `/ws`, derived from `VITE_API_BASE_URL`, and sends the token only in the native STOMP `CONNECT`
header:

```text
Authorization: Bearer <access-token>
```

The token is never added to the WebSocket URL or logged. A token change replaces the connection;
logout deactivates it and clears the realtime Redux state.

## Home subscription and reconnect

The selected home ID is shared through the small home slice. The lifecycle asks the singleton to
subscribe to `/topic/homes/{homeId}/events`. Selecting another home first unsubscribes the old
STOMP subscription, then subscribes the new one. Duplicate subscriptions are ignored.

STOMP reconnect uses exponential delays from 1 to 10 seconds. Incoming and outgoing heartbeats
are both 20 seconds, matching the backend default. After a transport reconnect, the singleton
authenticates again and restores the selected-home subscription automatically. REST behavior is
not blocked when realtime is unavailable.

## Consuming events in a feature

The Redux `realtime` slice stores infrastructure state only: status, subscribed home, last event
time, and a safe error message. Every accepted event also appears as a `realtime/realtimeEventReceived`
action in Redux DevTools. Domain data does not belong in that slice.

A feature registers a handler once at feature lifecycle level and dispatches its own typed Redux
action:

```ts
const unregister = realtimeEventDispatcher.register<DevicePayload>(
  'DEVICE_STATE_CHANGED',
  (event) => store.dispatch(deviceStateChanged(event.data)),
);
```

Call `unregister` during feature cleanup. Sensor, device, and notification events all use this same
dispatcher. The transport parses the shared `RealtimeEvent<T>` contract and keeps a bounded cache
of recent `eventId` values to ignore simple duplicates.

`NotificationLifecycle` is the implemented notification consumer. A `NOTIFICATION_CREATED` event
contains only safe metadata (`notificationId`, `recipientId`, `homeId`, `isRead`, `createdAt`), so
the lifecycle verifies the active user/home and retrieves the private notification content through
`GET /notifications/{notificationId}`. The notification slice then inserts by notification ID,
which also keeps insertion idempotent if distinct events reference the same notification.

Chi tiết đầy đủ về Notification Frontend nằm tại
[`FRONTEND_NOTIFICATION.md`](./FRONTEND_NOTIFICATION.md).

To add a backend-supported event, add its exact string value to `REALTIME_EVENT_TYPES`, then
register a feature handler. Do not add a new socket. The backend has no durable replay or global
ordering guarantee, so consumers should refresh authoritative REST data when recovery requires it.

## Local configuration and manual verification

Development keeps the existing local backend through `.env.development`. For another environment,
set `VITE_API_BASE_URL` to its REST base URL. The client converts that configured origin from
`http`/`https` to `ws`/`wss` and appends `/ws`.

1. Start the existing backend and frontend, then log in normally.
2. Open Redux DevTools and select a home on `/home`.
3. Confirm `realtime.status` becomes `connected` and `activeHomeId` is the selected home.
4. Publish a backend test event for that home.
5. Confirm a `realtime/realtimeEventReceived` action contains the matching `RealtimeEvent`.
6. Switch homes and verify `activeHomeId` changes; log out and verify status returns to
   `disconnected` with no active home.
