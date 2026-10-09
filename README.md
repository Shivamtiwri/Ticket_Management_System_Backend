  cd backend
     npm install
     .env.example .env      

   Tests:

  npm test
  npm run test:coverage

   API integration tests use only `TEST_MONGODB_URI`; they never load the application's `.env` database URI. Set it to a dedicated test database whose name ends in `_test`, for example `mongodb://127.0.0.1:27017/ticket_management_test`. Without this variable the integration suites are reported as skipped. If configured but unreachable, the suites fail during setup rather than silently passing. Tests delete only fixture IDs they created.

   .env:

     NODE_ENV=development
     PORT=5000
     MONGODB_URI=mongodb://localhost:27017/ticket_management
     JWT_SECRET=<generate-a-long-random-string>
     JWT_EXPIRES_IN=7d
     JWT_REFRESH_EXPIRES_IN_DAYS=30
     FRONTEND_URL=http://localhost:5173
     UPLOAD_DIR=uploads
     MAX_FILE_SIZE=5242880
     ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/plain
     CLOUDINARY_CLOUD_NAME=<your Cloudinary cloud name>
     CLOUDINARY_API_KEY=<your Cloudinary API key>
     CLOUDINARY_API_SECRET=<your Cloudinary API secret>
     CLOUDINARY_FOLDER=ticket-attachments
     BCRYPT_ROUNDS=12
     RATE_LIMIT_WINDOW_MS=900000
     RATE_LIMIT_MAX=100

   Configure the Cloudinary values from your Cloudinary dashboard in `backend/.env`. New attachments are uploaded to Cloudinary through the existing file picker/upload flow. Existing files in `uploads/` continue to work.

   Start in development (hot reload via nodemon):

     npm run dev

   Seed demo users (optional but recommended):

     npm run seed

   Production build:

     npm run build
     npm start
