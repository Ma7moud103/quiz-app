**Design Quiz Console Overview**

This is the short explanation for anyone learning the app. It describes who uses it, what each page does, and how the pieces fit together.

## Who uses it?
- **Admins/instructors:** log in, manage question banks, build quizzes, and review learner results.
- **Learners/students:** log in, pick a quiz, answer the questions, and see their score plus a review.

## What the app does (simple flow)
1. **Login** – visitors land on `index.html`, enter the credentials, and the app moves them to the right place based on their role (admins → `question-bank.html`, learners → `dashboard.html`).
2. **Question Bank page** – admins see a table of questions, filters, and a “Create Question” modal. They can add/edit questions (minimum 2 options, at least one correct) and use the quiz builder at the bottom to bundle questions together.
3. **Dashboard page** – students browse the quizzes, filter/search, and hit “Start quiz” (admins do not see that button). Starting a quiz stores the session and jumps to the quiz runner.
4. **Quiz runner** – shows one question at a time, lets users pick answers, tracks progress/score, and saves the result before sending them to the results page.
5. **Results page** – displays the score summary, friendly message, and an optional review list that highlights which answers were correct or chosen.

## Extras to keep in mind
- The modal confirmations (delete, logout) come from the shared `confirm.js` helper; it opens the same overlay and returns a simple yes/no promise.  
