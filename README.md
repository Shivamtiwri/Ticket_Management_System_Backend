  cd backend
     npm install
     .env.example .env      

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
     BCRYPT_ROUNDS=12
     RATE_LIMIT_WINDOW_MS=900000
     RATE_LIMIT_MAX=100

   Start in development (hot reload via nodemon):

     npm run dev

   Seed demo users (optional but recommended):

     npm run seed

   Production build:

     npm run build
     npm start
