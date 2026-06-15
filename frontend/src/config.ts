// Configuration for the FastAPI backend connection.
// If testing on a physical device, change 'localhost' to your computer's local network IP address (e.g. '192.168.1.100')
export const BACKEND_HOST = process.env.EXPO_PUBLIC_BACKEND_IP || '192.168.0.15';
export const BACKEND_PORT = process.env.EXPO_PUBLIC_BACKEND_PORT || '8000';

export const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
export const BACKEND_WS_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws`;
