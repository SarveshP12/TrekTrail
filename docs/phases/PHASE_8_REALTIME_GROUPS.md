# Phase 8: Real-Time Features & Group Sessions

## Phase Title

**Real-Time Features & Group Sessions — WebSocket Server, Live Location Sharing, and Group Trek Management**

---

## Objective

Build the Socket.IO real-time server and integrate it with the mobile client to enable live group trek sessions: create/join a group, broadcast live locations, display all members on a shared map, and sync group stats in real time. After this phase, multiple users can trek together (or remotely) with a shared live map and group leaderboard.

---

## Features Implemented in This Phase

- Socket.IO server (Node.js) with room-based group sessions
- Group session lifecycle: create → share invite code → join → trek → end
- Live location broadcasting (1 Hz per member)
- Server-side aggregation of group stats (who's ahead, total group distance)
- Mobile: group map view with all members' markers
- Mobile: group HUD showing member list with live distance, speed
- Join-by-code flow with QR code generation
- Presence detection (member online/offline/paused)
- Backend REST endpoints for group CRUD (create, list, join, leave)

---

## Tasks Breakdown

* Task 1: Scaffold Socket.IO server with authentication middleware
* Task 2: Implement room management (create room, join room, leave room)
* Task 3: Implement `location:update` event handler and broadcaster
* Task 4: Implement presence tracking (online/offline/paused per member)
* Task 5: Implement server-side group stats aggregation
* Task 6: Build backend REST endpoints for group sessions (CRUD)
* Task 7: Build mobile Socket.IO client service
* Task 8: Build group creation flow UI (create → get invite code → share)
* Task 9: Build group join flow UI (enter code / scan QR)
* Task 10: Build group map view (all members on shared map)
* Task 11: Build group HUD component (member list with live stats)
* Task 12: Write integration tests (multi-client socket scenario)

---

## File Structure for This Phase

```
realtime/
├── src/
│   ├── index.ts                          # Entry: HTTP server + Socket.IO attach
│   ├── config.ts                         # Env vars: port, Redis URL, JWT secret
│   ├── auth.ts                           # Socket middleware: verify JWT
│   ├── rooms/
│   │   ├── RoomManager.ts                # Create / join / leave / destroy rooms
│   │   ├── PresenceTracker.ts            # Track member online/offline/paused
│   │   └── GroupStatsAggregator.ts       # Aggregate live stats per room
│   ├── handlers/
│   │   ├── connectionHandler.ts          # on('connection') → setup listeners
│   │   ├── locationHandler.ts            # on('location:update') → broadcast
│   │   ├── groupHandler.ts              # on('group:create'), on('group:join'), etc.
│   │   └── presenceHandler.ts            # on('disconnect') → mark offline
│   └── types.ts                          # Shared types
├── package.json
├── tsconfig.json
└── tests/
    ├── room.test.ts
    └── location.test.ts

backend/app/
├── api/
│   └── groups.py                         # REST: POST /groups, GET /groups, POST /groups/{id}/join
├── services/
│   └── group_service.py                  # Group session CRUD
├── schemas/
│   └── group.py                          # GroupCreate, GroupRead, GroupMemberRead

mobile/src/
├── services/
│   └── realtime/
│       ├── SocketClient.ts               # Socket.IO client wrapper
│       └── GroupSessionManager.ts         # Orchestrates group join/create/leave
├── screens/
│   ├── GroupCreateScreen.tsx
│   ├── GroupJoinScreen.tsx
│   └── GroupTrekScreen.tsx               # Shared map + group HUD
├── components/
│   ├── GroupHUD.tsx                       # Member list with live stats
│   ├── MemberMarker.tsx                  # Map marker for other members
│   └── InviteCodeCard.tsx                # Display / share invite code + QR
```

---

## Implementation Guide

### Task 1 — Socket.IO Server with Auth

`realtime/src/index.ts`:

```typescript
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { authMiddleware } from './auth';
import { connectionHandler } from './handlers/connectionHandler';

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// JWT authentication middleware
io.use(authMiddleware);

io.on('connection', (socket) => {
  connectionHandler(io, socket);
});

httpServer.listen(config.port, () => {
  console.log(`✓ Real-time server running on port ${config.port}`);
});

export { io };
```

`realtime/src/auth.ts`:

```typescript
import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { config } from './config';

export function authMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    socket.data.userId = (payload as any).sub;
    socket.data.displayName = (payload as any).display_name || 'Trekker';
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}
```

### Task 2 — Room Manager

`realtime/src/rooms/RoomManager.ts`:

```typescript
import crypto from 'crypto';

interface RoomState {
  id: string;
  inviteCode: string;
  hostUserId: string;
  members: Map<string, MemberState>; // socketId → state
  createdAt: Date;
}

interface MemberState {
  userId: string;
  displayName: string;
  socketId: string;
  status: 'online' | 'paused' | 'offline';
  lastLocation?: { lat: number; lng: number; altitude: number | null; speed: number };
  distance: number;
}

class RoomManager {
  private rooms = new Map<string, RoomState>();
  private codeToRoom = new Map<string, string>(); // inviteCode → roomId

  createRoom(hostUserId: string, hostSocketId: string, hostName: string): RoomState {
    const roomId = crypto.randomUUID();
    const inviteCode = this.generateInviteCode();

    const room: RoomState = {
      id: roomId,
      inviteCode,
      hostUserId,
      members: new Map(),
      createdAt: new Date(),
    };

    room.members.set(hostSocketId, {
      userId: hostUserId,
      displayName: hostName,
      socketId: hostSocketId,
      status: 'online',
      distance: 0,
    });

    this.rooms.set(roomId, room);
    this.codeToRoom.set(inviteCode, roomId);

    return room;
  }

  joinRoom(inviteCode: string, userId: string, socketId: string, displayName: string): RoomState | null {
    const roomId = this.codeToRoom.get(inviteCode.toUpperCase());
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.members.set(socketId, {
      userId,
      displayName,
      socketId,
      status: 'online',
      distance: 0,
    });

    return room;
  }

  leaveRoom(roomId: string, socketId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.members.delete(socketId);
    if (room.members.size === 0) {
      this.codeToRoom.delete(room.inviteCode);
      this.rooms.delete(roomId);
    }
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByCode(code: string): RoomState | undefined {
    const roomId = this.codeToRoom.get(code.toUpperCase());
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  updateMemberLocation(
    roomId: string,
    socketId: string,
    location: { lat: number; lng: number; altitude: number | null; speed: number },
    distanceDelta: number,
  ): MemberState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const member = room.members.get(socketId);
    if (!member) return null;

    member.lastLocation = location;
    member.distance += distanceDelta;
    return member;
  }

  private generateInviteCode(): string {
    // 6-char alphanumeric code
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }
}

export const roomManager = new RoomManager();
```

### Task 3 — Location Event Handler

`realtime/src/handlers/locationHandler.ts`:

```typescript
import { Server, Socket } from 'socket.io';
import { roomManager } from '../rooms/RoomManager';

interface LocationUpdate {
  roomId: string;
  lat: number;
  lng: number;
  altitude: number | null;
  speed: number;
  distanceDelta: number; // meters since last update
}

export function registerLocationHandler(io: Server, socket: Socket) {
  socket.on('location:update', (data: LocationUpdate) => {
    const member = roomManager.updateMemberLocation(
      data.roomId,
      socket.id,
      { lat: data.lat, lng: data.lng, altitude: data.altitude, speed: data.speed },
      data.distanceDelta,
    );

    if (!member) return;

    // Broadcast to all other members in the room
    socket.to(data.roomId).emit('location:member', {
      userId: member.userId,
      displayName: member.displayName,
      lat: data.lat,
      lng: data.lng,
      altitude: data.altitude,
      speed: data.speed,
      distance: member.distance,
    });
  });
}
```

### Task 5 — Connection Handler

`realtime/src/handlers/connectionHandler.ts`:

```typescript
import { Server, Socket } from 'socket.io';
import { roomManager } from '../rooms/RoomManager';
import { registerLocationHandler } from './locationHandler';

export function connectionHandler(io: Server, socket: Socket) {
  const userId = socket.data.userId;
  const displayName = socket.data.displayName;

  // Group lifecycle events
  socket.on('group:create', (callback) => {
    const room = roomManager.createRoom(userId, socket.id, displayName);
    socket.join(room.id);
    callback({ roomId: room.id, inviteCode: room.inviteCode });
  });

  socket.on('group:join', ({ inviteCode }, callback) => {
    const room = roomManager.joinRoom(inviteCode, userId, socket.id, displayName);
    if (!room) {
      callback({ error: 'Invalid invite code' });
      return;
    }
    socket.join(room.id);

    // Notify existing members
    socket.to(room.id).emit('group:member_joined', {
      userId,
      displayName,
    });

    // Return current members
    const members = Array.from(room.members.values()).map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      status: m.status,
      lastLocation: m.lastLocation,
      distance: m.distance,
    }));
    callback({ roomId: room.id, members });
  });

  socket.on('group:leave', ({ roomId }) => {
    roomManager.leaveRoom(roomId, socket.id);
    socket.leave(roomId);
    io.to(roomId).emit('group:member_left', { userId });
  });

  // Location broadcasting
  registerLocationHandler(io, socket);

  // Disconnect → mark offline
  socket.on('disconnect', () => {
    // Find all rooms this socket was in and update status
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue; // skip default room
      const room = roomManager.getRoom(roomId);
      if (!room) continue;
      const member = room.members.get(socket.id);
      if (member) {
        member.status = 'offline';
        io.to(roomId).emit('group:member_status', {
          userId: member.userId,
          status: 'offline',
        });
      }
    }
  });
}
```

### Task 7 — Mobile Socket Client

`mobile/src/services/realtime/SocketClient.ts`:

```typescript
import { io, Socket } from 'socket.io-client';

interface MemberLocation {
  userId: string;
  displayName: string;
  lat: number;
  lng: number;
  altitude: number | null;
  speed: number;
  distance: number;
}

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(serverUrl: string, token: string): void {
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => this.emit('connected'));
    this.socket.on('disconnect', () => this.emit('disconnected'));

    this.socket.on('location:member', (data: MemberLocation) => {
      this.emit('memberLocation', data);
    });

    this.socket.on('group:member_joined', (data) => this.emit('memberJoined', data));
    this.socket.on('group:member_left', (data) => this.emit('memberLeft', data));
    this.socket.on('group:member_status', (data) => this.emit('memberStatus', data));
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  createGroup(): Promise<{ roomId: string; inviteCode: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('group:create', (response: any) => resolve(response));
    });
  }

  joinGroup(inviteCode: string): Promise<{ roomId: string; members: any[] } | { error: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('group:join', { inviteCode }, (response: any) => resolve(response));
    });
  }

  leaveGroup(roomId: string): void {
    this.socket?.emit('group:leave', { roomId });
  }

  sendLocation(roomId: string, lat: number, lng: number, altitude: number | null, speed: number, distanceDelta: number): void {
    this.socket?.emit('location:update', { roomId, lat, lng, altitude, speed, distanceDelta });
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }
}

export const socketClient = new SocketClient();
```

### Task 10 — Group Trek Screen

`mobile/src/screens/GroupTrekScreen.tsx`:

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { TrekMap } from '../components/map/TrekMap';
import { GroupHUD } from '../components/GroupHUD';
import { MemberMarker } from '../components/MemberMarker';
import { TrekHUD } from '../components/TrekHUD';
import { TrekControls } from '../components/TrekControls';
import { socketClient } from '../services/realtime/SocketClient';
import { useTrekRecorder } from '../context/TrekRecorderContext';

interface MemberData {
  userId: string;
  displayName: string;
  lat: number;
  lng: number;
  speed: number;
  distance: number;
  status: string;
}

export function GroupTrekScreen({ route }: any) {
  const { roomId } = route.params;
  const { isRecording, stats, start, stop, pause, resume } = useTrekRecorder();
  const [members, setMembers] = useState<Map<string, MemberData>>(new Map());

  useEffect(() => {
    const onMemberLocation = (data: MemberData) => {
      setMembers((prev) => new Map(prev).set(data.userId, data));
    };
    const onMemberLeft = ({ userId }: { userId: string }) => {
      setMembers((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    };

    socketClient.on('memberLocation', onMemberLocation);
    socketClient.on('memberLeft', onMemberLeft);

    return () => {
      socketClient.off('memberLocation', onMemberLocation);
      socketClient.off('memberLeft', onMemberLeft);
    };
  }, []);

  const memberArray = Array.from(members.values());

  return (
    <View style={styles.container}>
      <TrekMap followUser>
        {memberArray.map((m) => (
          <MemberMarker
            key={m.userId}
            displayName={m.displayName}
            latitude={m.lat}
            longitude={m.lng}
          />
        ))}
      </TrekMap>
      <View style={styles.hud}><TrekHUD /></View>
      <View style={styles.groupHud}>
        <GroupHUD members={memberArray} />
      </View>
      <View style={styles.controls}>
        <TrekControls
          isRecording={isRecording}
          onPause={pause}
          onResume={resume}
          onStop={stop}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hud: { position: 'absolute', top: 60, left: 16, right: 16 },
  groupHud: { position: 'absolute', right: 16, top: 200, width: 160 },
  controls: { position: 'absolute', bottom: 40, left: 16, right: 16 },
});
```

---

## Dependencies

### Real-time server (`realtime/package.json`)

```json
{
  "dependencies": {
    "socket.io": "^4.7.4",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.11.0",
    "socket.io-client": "^4.7.4",
    "vitest": "^1.2.0"
  }
}
```

### Mobile additions

```json
{
  "socket.io-client": "^4.7.4",
  "react-native-qrcode-svg": "^6.3.0"
}
```

---

## Expected Output

After completing this phase:

1. A user can create a group session and receive a 6-character invite code.
2. Other users join by entering the code or scanning a QR code.
3. All group members see each other's live locations on a shared map.
4. The group HUD shows each member's name, distance, speed, and online status.
5. Members going offline are shown as "offline" — their last position remains on the map.
6. The host can end the group session, which notifies all members.

---

## Testing Instructions

### 1. Multi-Client Socket Test

```bash
cd realtime
npx vitest run tests/room.test.ts
```

Verify:
- Room creation returns a valid invite code
- Second client joins with the code successfully
- Location broadcasts are received by other members
- Disconnect triggers offline status

### 2. End-to-End Group Trek

- Device A: Create group → copy invite code
- Device B: Join group with code
- Both start trek recording
- Verify both see each other's markers on the map within 2 seconds
- Device B pauses → verify A sees status change to "paused"

### 3. Load / Stress Test

```bash
# Use the load test script to simulate 20 concurrent members
node tests/load-test.js --members=20 --duration=60
# Verify server CPU < 50%, memory < 200 MB, broadcast latency < 100 ms
```
