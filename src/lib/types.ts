export type GameSetup = {
  parentA?: string;
  parentB?: string;
  world?: string;
};

export type GameState = {
  turn: number;
  year: number;
  phase: string;
  child: {
    health: number;
    security: number;
    curiosity: number;
    social: number;
    learning: number;
    mood: number;
  };
  family: {
    money: number;
    time: number;
    stability: number;
    support: number;
    pressure: number;
  };
  flags: string[];
};

export type RoomPayload = {
  room: {
    id: string;
    room_code: string;
    status: string;
    current_turn: number;
    current_year: number;
    phase: string;
  };
  players: Array<{
    id: string;
    display_name: string;
    role: string;
    created_at: string;
  }>;
  setup: GameSetup;
  state: GameState;
  messages: Array<{
    id: number;
    player_id: string | null;
    author: string;
    kind: string;
    content: string;
    created_at: string;
  }>;
};
