import { io, type Socket } from "socket.io-client";
let socket: Socket | null = null;
export function getSocket() { const token = localStorage.getItem("bodhi_token"); if (!socket || socket.disconnected) socket = io(import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000", { auth: { token }, autoConnect: true }); return socket; }
export function closeSocket() { socket?.disconnect(); socket = null; }
