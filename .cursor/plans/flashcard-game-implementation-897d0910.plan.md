<!-- 897d0910-9520-41e5-9161-3e564e922bd5 8ddafb8b-4e5b-4120-98f3-a228ce62513e -->
# Flashcard Game Implementation Plan

## Overview

Build a teacher-hosted recitation game where students are selected one-by-one via card draw, answer questions, and can use 3 life cards (Call a Friend, Hint, Re-draw) throughout the game session.

---

## Phase 1: Database Models & Backend API

### 1.1 Create FlashcardTask Model

**File**: `server/models/FlashcardTask.js`

- Schema fields:
  - `subjectId`, `teacherId`, `title`, `description`
  - `status: 'draft' | 'published' | 'closed'`
  - `questions: []` array with:
    - `text`, `type: 'multiple_choice' | 'text_input'`
    - `options: []` (for MCQ), `acceptedAnswers: string` (for text)
    - `points: number`, `hasTimer: boolean`, `timeLimitSec: number`
  - `settings: { allowRepeatedStudents: boolean }`
  - Timestamps
- Similar structure to `GridQuestTask.js`

### 1.2 Create FlashcardAttempt Model

**File**: `server/models/FlashcardAttempt.js`

- Schema fields:
  - `sessionId`, `taskId`, `subjectId`, `studentId`
  - `questionIndex`, `selectedOption`, `textAnswer`
  - `isCorrect`, `pointsEarned`, `timeTakenSec`
  - `lifeCardUsed: 'call_friend' | 'hint' | 'redraw' | null`
  - `helperId` (for Call a Friend), `helperAnswer`, `helperCorrect`
  - `revealedHint: string`
  - Timestamps
- Similar to `GridQuestAttempt.js`

### 1.3 Backend Routes

**File**: `server/routes/flashcard.js`

- `GET /api/flashcard/tasks?teacherId=X` - list tasks
- `POST /api/flashcard/tasks` - create task
- `PUT /api/flashcard/tasks/:id` - update task
- `DELETE /api/flashcard/tasks/:id` - delete task
- `GET /api/flashcard/tasks/:id` - get single task
- Follow pattern from `server/routes/gridquest.js`

### 1.4 Analytics Controller

**File**: `server/controllers/flashcardAnalyticsController.js`

- `GET /api/flashcard/analytics/:sessionId`
- Return:
  - Session metadata
  - Per-student stats (turns taken, correct/wrong, life cards used)
  - Per-question stats (accuracy, average time)
  - Call a Friend success rate
- Follow pattern from `gridQuestAnalyticsController.js`

---

## Phase 2: Backend Socket.io Real-time Logic

### 2.1 Socket Event Handlers

**File**: `server/server.js` (add to existing socket logic around line 300+)

**Room Management**:

- `flashcard:create-room` - teacher creates room with taskId
- `flashcard:join` - students join via roomCode
- `flashcard:leave` - handle disconnects

**Game Flow Events**:

- `flashcard:start-game` - teacher starts, emit initial state
- `flashcard:draw-student-card` - teacher triggers, server picks random student, emit with animation delay
- `flashcard:draw-question-card` - selected student triggers, server picks random question
- `flashcard:submit-answer` - student submits answer
- `flashcard:use-life-card` - student uses Call Friend/Hint/Redraw
- `flashcard:choose-friend` - student selects helper for Call a Friend
- `flashcard:friend-answer` - helper submits answer
- `flashcard:reveal` - show correct answer and scoring
- `flashcard:next-turn` - proceed to next student selection
- `flashcard:end-game` - teacher ends session

**State Tracking** (in-memory per room):

- `studentsInRoom: []` with `{ id, name, hasBeenCalled, lifeCards: { callFriend, hint, redraw } }`
- `questionsPool: []` (remove used questions)
- `currentTurnStudentId`, `currentQuestionIndex`
- `phase: 'lobby' | 'draw-student' | 'draw-question' | 'answering' | 'reveal' | 'finished'`

---

## Phase 3: Frontend - Teacher Management

### 3.1 Flashcard Management Page

**File**: `client/src/pages/teachers/FlashcardManagement.tsx`

- Layout similar to `GridQuestManagement.tsx`
- Features:
  - List all flashcard tasks with filters (status, subject)
  - Create/Edit/Delete tasks
  - Status badges (draft, published, closed)
  - Host button (navigates to `/teacher/flashcard/host`)
  - QR code modal for student joining

### 3.2 Flashcard Task Form Component

**File**: `client/src/components/FlashcardForm.tsx`

- Form fields:
  - Title, description, subject selector
  - Question builder with:
    - Type toggle (Multiple Choice / Text Input)
    - Question text
    - For MCQ: 2-4 options with correct answer radio
    - For Text: accepted answers (comma-separated)
    - Points input
    - Timer toggle + time limit input (seconds)
  - Add/remove question buttons
- Follow pattern from `QuizForm.tsx` (lines 44-482)

### 3.3 Styles

**File**: `client/src/styles/flashcard_management.css`

- Use CSS root variables for color palette:
```css
:root {
  --fc-primary: #ff6b6b; /* playful red */
  --fc-secondary: #ffd93d; /* bright yellow */
  --fc-accent: #6bcf7f; /* fresh green */
  --fc-surface: #fff9f0; /* warm white */
  --fc-ink: #2d3748;
}
```

- Card-style UI elements (rounded corners, shadow)
- Follow structure from `grid_quest_management.css`

---

## Phase 4: Frontend - Teacher Host View

### 4.1 Host Flashcard Page

**File**: `client/src/pages/teachers/HostFlashcard.tsx`

**Phases**:

1. **Lobby**:

   - Display room code + QR
   - List joined students with status
   - Game mechanics explanation panel
   - Start Game button

2. **Draw Student Card**:

   - Animated card shuffle/flip
   - Reveal selected student
   - Teacher-only "Draw Student" button
   - Show available students count

3. **Draw Question Card**:

   - Button available to selected student + teacher
   - Card shuffle/flip animation
   - Reveal question text

4. **Answering (Clue Phase)**:

   - Show question to all (teacher + students)
   - Selected student sees:
     - Answer input (text or MCQ options)
     - Life card buttons (disabled if already used)
     - Submit button
   - Timer progress bar (if enabled for question)
   - Life card effect animations:
     - "Call a Friend" → show friend selector modal → friend sees input
     - "Hint" → show fill-in-the-blank hint
     - "Re-draw" → draw new question card

5. **Reveal Phase**:

   - Show correct answer(s)
   - Show student's answer (and friend's if used Call a Friend)
   - Display points earned (+/-)
   - Next Turn button (teacher)

6. **Finished**:

   - Show session summary
   - Top performers
   - View Analytics button

**Socket Integration**:

- Listen to all `flashcard:*` events
- Emit actions based on teacher interactions
- Update UI state reactively

**Reference**: Follow structure from `HostGridQuest.tsx` (lines 10-1445) and `HostQuizGame.tsx`

### 4.2 Styles

**File**: `client/src/styles/host_flashcard.css`

- Card flip animations (CSS 3D transforms)
- Shuffle animation (cards fanning out)
- Life card button styles with icons
- Timer bar (similar to Grid Quest)
- Responsive layouts (desktop + mobile)
- Follow patterns from `host_grid_quest.css`

---

## Phase 5: Frontend - Student View

### 5.1 Student Flashcard Page

**File**: `client/src/pages/student/StudentFlashcard.tsx`

**Phases** (synchronized with teacher):

1. **Lobby**: Show room code, waiting message, list of classmates
2. **Draw Student Card**: Show animation, reveal who was selected
3. **Draw Question Card**: If selected, show "Draw Question" button; otherwise spectate
4. **Answering**:

   - If selected:
     - Show question
     - Answer input (text/MCQ)
     - Life card buttons (show remaining count)
     - Submit button
   - If "Call a Friend" used by another:
     - Show modal with question + input
     - Submit answer
   - If spectator: show question, see timer countdown

5. **Reveal**: See correct answer, selected student's answer, points awarded
6. **Finished**: Show personal stats, life cards used, questions answered

**Life Card Modals**:

- **Call a Friend**: Modal with list of available students (checkboxes), confirm selection
- **Hint**: Display fill-in-the-blank hint (e.g., "a _ _ l e" for "apple")
- **Re-draw**: Trigger new question card draw with animation

**Socket Integration**:

- Listen to `flashcard:*` events
- Emit student actions (draw, answer, use life card, choose friend)
- Update phase/state

**Reference**: `StudentGridQuest.tsx` (lines 9-635) and `StudentLiveQuiz.tsx`

### 5.2 Join Flow

**File**: `client/src/pages/student/FlashcardJoin.tsx`

- Code entry input
- QR scanner option
- Navigate to `/student/flashcard/:roomCode`
- Follow pattern from `GridQuestJoin.tsx`

### 5.3 Styles

**File**: `client/src/styles/student_flashcard.css`

- Card animations (match teacher view)
- Life card button styles (colorful, playful)
- Disabled life card visual (greyed out)
- Answer input styling
- Modal styles for Call a Friend selection
- Mobile-first responsive design
- Follow `student_grid_quest.css` patterns

---

## Phase 6: Analytics & Routing

### 6.1 Analytics Page

**File**: `client/src/pages/teachers/FlashcardAnalytics.tsx`

- Session metadata (task title, date, duration)
- Summary cards:
  - Total students participated
  - Total questions answered
  - Life cards used breakdown
  - Average accuracy
- Student participation table:
  - Student name, turns taken, correct/wrong, points, life cards used
- Question breakdown:
  - Question text, accuracy %, avg time, life card usage
- Call a Friend success rate chart
- Export CSV button
- Follow structure from `GridQuestAnalytics.tsx` (lines 96-636)

### 6.2 Analytics Styles

**File**: `client/src/styles/flashcard_analytics.css`

- Cards, tables, charts
- Color-coded stats (green correct, red wrong)
- Follow `grid_quest_analytics.css`

### 6.3 Routing Updates

**File**: `client/src/App.tsx`

Add teacher routes around line 84-98 (after grid-quest routes):

```tsx
<Route path="/teacher/flashcard" element={
  <ProtectedRoute allowedRoles={['teacher']}>
    <FlashcardManagement />
  </ProtectedRoute>
} />
<Route path="/teacher/flashcard/host" element={
  <ProtectedRoute allowedRoles={['teacher']}>
    <HostFlashcard />
  </ProtectedRoute>
} />
<Route path="/teacher/flashcard-analytics/:sessionId" element={
  <ProtectedRoute allowedRoles={['teacher']}>
    <FlashcardAnalytics />
  </ProtectedRoute>
} />
```

Add student routes around line 172-178 (in solo games section, after `/student/solo-games/quiz`):

```tsx
<Route path="/student/solo-games/flashcard/join" element={
  <ProtectedRoute allowedRoles={['student']}>
    <StudentLayout><FlashcardJoin /></StudentLayout>
  </ProtectedRoute>
} />
<Route path="/student/flashcard/:roomCode" element={
  <ProtectedRoute allowedRoles={['student']}>
    <StudentFlashcard />
  </ProtectedRoute>
} />
```

### 6.4 Navigation Links

- **Teacher**: Add "Flashcard" game card to Solo Games menu (`SoloGames.tsx` around line 5-33)
- **Student**: Add "Flashcard" game card to Solo Games menu (`StudentSoloGames.tsx` around line 5-29) - should navigate to `/student/solo-games/flashcard/join`

---

## Phase 7: Polish & Testing

### 7.1 Card Animations

- Implement CSS 3D flip animations (front: card back design, back: student/question content)
- Shuffle animation (cards spread, one selected)
- Smooth transitions between phases

### 7.2 Hint Generation Logic

Create utility function for fill-in-the-blank hints:

```ts
// client/src/utils/hintGenerator.ts
export function generateHint(answer: string): string {
  // Show first letter, last letter, replace others with _
  // Example: "apple" → "a _ _ l e"
}
```

### 7.3 Points Calculation

**Call a Friend logic**:

- If helper correct: answerer gets 50% points, helper gets 100% points
- If helper wrong: both lose the question's point value

### 7.4 Edge Cases

- All students called → reset student pool (if setting enabled)
- All questions used → end game automatically
- Student disconnect during their turn → skip to next
- Timer expires → auto-submit empty answer

### 7.5 Testing Checklist

- Create flashcard task (both question types)
- Host game, students join
- Student card draw (animation, correct selection)
- Question card draw (remove from pool)
- Answer submission (text + MCQ)
- Each life card:
  - Call a Friend (friend modal, scoring)
  - Hint (generate hint correctly)
  - Re-draw (new question)
- Timer countdown (optional per question)
- Reveal phase (show correct answer, points)
- End game (analytics)
- Mobile responsive (all phases)

---

## Implementation Order

1. Backend models + routes (Phase 1)
2. Socket.io real-time handlers (Phase 2)
3. Teacher management UI (Phase 3)
4. Teacher host view (Phase 4)
5. Student view (Phase 5)
6. Analytics + routing (Phase 6)
7. Polish animations + testing (Phase 7)

---

## Key Files to Reference

- **Grid Quest** (similar architecture): `HostGridQuest.tsx`, `StudentGridQuest.tsx`, `GridQuestManagement.tsx`
- **Quiz Game** (question handling): `QuizForm.tsx`, `HostQuizGame.tsx`
- **Socket patterns**: `server.js` (lines 135-669)
- **Styling patterns**: `host_grid_quest.css`, `grid_quest_management.css`

---

## Color Palette (Customizable via CSS Root)

```css
:root {
  --fc-primary: #ff6b6b;      /* Card red */
  --fc-secondary: #ffd93d;    /* Bright yellow */
  --fc-accent: #6bcf7f;       /* Fresh green */
  --fc-surface: #fff9f0;      /* Warm cream */
  --fc-ink: #2d3748;          /* Dark text */
  --fc-life-call: #4ecdc4;    /* Teal for Call Friend */
  --fc-life-hint: #f7b731;    /* Gold for Hint */
  --fc-life-redraw: #9b59b6;  /* Purple for Re-draw */
}
```

---

**Next Steps**: Confirm this plan, then begin implementation starting with backend infrastructure.