export interface RoomResponse {
  id: string;
  homeId: string;
  name: string;
  icon?: string | null;
  layoutX?: number | null;
  layoutY?: number | null;
  deviceCount?: number;
  createdAt?: string;
}

export interface RoomCreateRequest {
  name: string;
  icon?: string;
  layoutX?: number;
  layoutY?: number;
}

export interface RoomUpdateRequest {
  name: string;
  icon?: string;
  layoutX?: number;
  layoutY?: number;
}
