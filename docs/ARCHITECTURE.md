# QuizArena — Architecture

This document contains Mermaid diagrams describing the system architecture, data model, and key runtime flows.

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Client["Browser / Mobile"]
        NextJS["Next.js 14\n(App Router)"]
        WSHook["useGameSocket\n(WebSocket hook)"]
    end

    subgraph Backend["Django 5 Backend (ASGI)"]
        direction TB
        REST["Django REST Framework\n/api/..."]
        Channels["Django Channels 4\nGameConsumer"]
        Auth["Token Authentication"]
        Throttle["Rate Limiting\n(30/min anon, 100/min user)"]
    end

    subgraph Storage["Storage"]
        PG[("PostgreSQL\n(models)")]
        Redis[("Redis\n(channel layer)")]
    end

    subgraph External["External Services"]
        Gemini["Google Gemini 2.5 Flash\n(question generation)"]
    end

    NextJS -- "HTTP REST" --> REST
    WSHook -- "WebSocket\nws://host/ws/room/{code}/" --> Channels
    REST --> Auth
    REST --> Throttle
    REST --> PG
    Channels --> Redis
    Channels --> PG
    Channels --> Gemini
```

---

## 2. Database ER Diagram

```mermaid
erDiagram
    User {
        int id PK
        string username
        string email
        string password
    }

    UserProfile {
        int id PK
        int user_id FK
        string display_name
        int total_score
        int weekly_score
        int games_played
        string avatar
        datetime created_at
    }

    Friendship {
        int id PK
        int from_user_id FK
        int to_user_id FK
        string status
        datetime created_at
    }

    Achievement {
        int id PK
        string name
        string description
        string icon
        string condition_type
    }

    UserAchievement {
        int id PK
        int user_id FK
        int achievement_id FK
        datetime unlocked_at
    }

    Room {
        int id PK
        string code
        json categories
        string status
        int total_rounds
        int current_round
        bool is_public
        datetime scheduled_at
        datetime created_at
    }

    Player {
        int id PK
        int room_id FK
        int user_id FK
        string nickname
        int score
        bool is_host
        int current_streak
        int best_streak
        datetime joined_at
    }

    Question {
        int id PK
        int room_id FK
        int round_number
        text content
        json options
        string correct_answer
        text explanation
        datetime created_at
    }

    Answer {
        int id PK
        int player_id FK
        int question_id FK
        string chosen_option
        int response_time_ms
        int points_earned
        bool is_correct
        int streak_at_answer
        float multiplier_applied
    }

    User ||--|| UserProfile : "has"
    User ||--o{ Friendship : "sends (from_user)"
    User ||--o{ Friendship : "receives (to_user)"
    User ||--o{ UserAchievement : "unlocks"
    Achievement ||--o{ UserAchievement : "unlocked via"
    User ||--o{ Player : "plays as"
    Room ||--o{ Player : "contains"
    Room ||--o{ Question : "has"
    Player ||--o{ Answer : "submits"
    Question ||--o{ Answer : "answered by"
```

---

## 3. Game Flow Sequence Diagram

```mermaid
sequenceDiagram
    actor Host
    actor Player
    participant WS as WebSocket (Django Channels)
    participant DB as PostgreSQL
    participant AI as Google Gemini

    Host->>WS: connect ws/room/{code}/
    WS-->>Host: (connection accepted)

    Host->>WS: {"type": "join", "nickname": "Host", "avatar": "fox"}
    WS->>DB: Create Player(is_host=True)
    WS-->>Host: {"type": "player_joined", "nickname": "Host"}

    Player->>WS: connect ws/room/{code}/
    Player->>WS: {"type": "join", "nickname": "Player1", "avatar": "wolf"}
    WS->>DB: Create Player(is_host=False)
    WS-->>Host: {"type": "player_joined", "nickname": "Player1"}
    WS-->>Player: {"type": "player_joined", "nickname": "Player1"}

    Host->>WS: {"type": "start_game"}
    WS->>DB: Room.status = "in_progress"
    WS-->>Host: {"type": "game_start", "total_rounds": 10}
    WS-->>Player: {"type": "game_start", "total_rounds": 10}

    loop For each round (1..total_rounds)
        WS->>AI: Generate question(categories)
        AI-->>WS: {question, options, correct_answer, explanation}
        WS->>DB: Create Question(round_number=N)
        WS-->>Host: {"type": "question", "round_number": N, ...}
        WS-->>Player: {"type": "question", "round_number": N, ...}

        Host->>WS: {"type": "answer", "answer": "A", "response_time_ms": 4200}
        WS->>DB: Create Answer, calculate score
        WS-->>Host: {"type": "answer_result", "is_correct": true, "points_earned": 1400}

        Player->>WS: {"type": "answer", "answer": "C", "response_time_ms": 12000}
        WS->>DB: Create Answer, calculate score
        WS-->>Player: {"type": "answer_result", "is_correct": false, "points_earned": 0}
    end

    WS->>DB: Room.status = "finished"
    WS->>DB: Update UserProfile scores & games_played
    WS->>DB: Check & award Achievements
    WS-->>Host: {"type": "game_over", "leaderboard": [...]}
    WS-->>Player: {"type": "game_over", "leaderboard": [...]}
```

---

## 4. WebSocket Message Flow Diagram

```mermaid
sequenceDiagram
    participant C as Client (useGameSocket)
    participant WS as GameConsumer
    participant CL as Channel Layer (Redis)
    participant DB as PostgreSQL

    note over C,DB: --- Connection & Join ---
    C->>WS: WS connect
    C->>WS: {"type":"join", "nickname":"...", "avatar":"..."}
    WS->>DB: get/create Player
    WS->>CL: group_send(room_group, player_joined)
    CL-->>C: {"type":"player_joined", ...}

    note over C,DB: --- Reconnect flow ---
    C--xWS: Connection dropped
    note over WS: Grace period starts (30s)
    C->>WS: WS reconnect (exponential backoff: 1s→2s→4s→8s→10s)
    C->>WS: {"type":"rejoin", "nickname":"..."}
    WS->>DB: Lookup existing Player
    WS-->>C: {"type":"game_state", "room_status":"in_progress", "current_round":5, ...}

    note over C,DB: --- In-game answer ---
    C->>WS: {"type":"answer", "answer":"B", "response_time_ms":8500}
    WS->>DB: Create Answer, calculate points + streak multiplier
    WS-->>C: {"type":"answer_result", "is_correct":true, "points_earned":1200, "streak":2}

    note over C,DB: --- Power-up: 50/50 ---
    C->>WS: {"type":"use_powerup", "powerup":"fifty_fifty", "round_number":3}
    WS-->>C: {"type":"powerup_result", "powerup":"fifty_fifty", "removed_options":["B","D"]}

    note over C,DB: --- Power-up: Extra time ---
    C->>WS: {"type":"use_powerup", "powerup":"extra_time", "round_number":3}
    WS-->>C: {"type":"powerup_result", "powerup":"extra_time", "extra_seconds":15}

    note over C,DB: --- Chat ---
    C->>WS: {"type":"chat_message", "text":"Good luck!"}
    WS->>CL: group_send(room_group, chat_message)
    CL-->>C: {"type":"chat_message", "nickname":"...", "text":"Good luck!"}

    note over C,DB: --- Game over ---
    WS->>DB: Finalize scores, check achievements
    WS->>CL: group_send(room_group, game_over)
    CL-->>C: {"type":"game_over", "leaderboard":[...]}
```

---

## 5. Scoring Algorithm

```mermaid
flowchart TD
    A[Player submits answer] --> B{Is correct?}
    B -- No --> Z[0 points]
    B -- Yes --> C[Base: 1000 pts]
    C --> D["Speed bonus: 500 × max(0, (30000 - response_time_ms) / 30000)"]
    D --> E[Base + Speed bonus = subtotal]
    E --> F{Check streak}
    F -- "streak 1-2" --> G[×1.0]
    F -- "streak 3" --> H[×1.2]
    F -- "streak 4" --> I[×1.4]
    F -- "streak 5" --> J[×1.6]
    F -- "streak 6+" --> K[×2.0]
    G & H & I & J & K --> L[subtotal × multiplier]
    L --> M{double_points\npowerup active?}
    M -- Yes --> N[×2]
    M -- No --> O[Final points added to score]
    N --> O
```

---

## 6. Constants Reference

| Constant | Value | Description |
|----------|-------|-------------|
| `TIMER_SECONDS` | 30 | Seconds per question |
| `BASE_POINTS` | 1 000 | Points for a correct answer |
| `MAX_SPEED_BONUS` | 500 | Maximum speed bonus |
| `GRACE_PERIOD_SECONDS` | 30 | Reconnect window before player removal |
| `MIN_PLAYERS_AUTO_START` | 2 | Minimum players to auto-start a public game |
| `PUBLIC_GAME_INTERVAL_MINUTES` | 30 | Interval between scheduled public games |
| `EXTRA_TIME_SECONDS` | 15 | Extra time added by `extra_time` power-up |
| `CHAT_MAX_LENGTH` | 200 | Maximum chat message length (chars) |
| `MAX_RECONNECT_RETRIES` | 5 | Frontend reconnect attempts (exponential backoff) |
