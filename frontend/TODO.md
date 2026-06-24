# TODO: Implement Delayed Result Release for Paid Quizzes

## Tasks
- [ ] Update Result model to include 'pending' status and releaseTime field.
- [ ] Modify submitQuiz in resultController.js to set status to 'pending' for paid quizzes and schedule release.
- [ ] Update script-quiz.js to show delay message for paid quizzes.
- [ ] Update quiz-results.html to add checkboxes for user selection and notification buttons.
- [ ] Update script-quiz-results.js to handle user selection and sending notifications/emails.
- [ ] Add new controller methods for releasing results and sending custom notifications.
- [ ] Update notificationController.js to support custom messages with links.
- [ ] Update nodemailer.js to include result notification email function.

## Followup Steps
- [ ] Test the flow: User attempts paid quiz -> sees delay message -> Admin sees pending result -> Admin selects user and sends notification/email.
