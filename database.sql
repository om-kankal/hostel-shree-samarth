CREATE DATABASE IF NOT EXISTS sspg;	
USE sspg;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

select * from admins;

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  registration_no VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(50) UNIQUE NOT NULL,
  room_type VARCHAR(50) DEFAULT 'shared',
  capacity INT DEFAULT 5,
  price DECIMAL(10,2) DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS beds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  bed_label VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'available',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  bed_id INT,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  status VARCHAR(50) DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  booking_id INT,
  amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0.00,
  payment_status VARCHAR(50) DEFAULT 'pending',
  due_date DATE,
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sms_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT,
  admin_id INT,
  booking_id INT,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'sent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNIQUE NOT NULL,
  first_name VARCHAR(100),
  middle_name VARCHAR(100),
  last_name VARCHAR(100),
  gender VARCHAR(20) DEFAULT 'male',
  date_of_birth DATE,
  course_major VARCHAR(150),
  current_year_semester VARCHAR(100),
  government_id_type VARCHAR(50),
  government_id_file_name VARCHAR(255),
  government_id_file_data LONGTEXT,
  guardian_name VARCHAR(150),
  guardian_relationship VARCHAR(50),
  guardian_phone VARCHAR(20),
  permanent_address TEXT,
  admission_date DATE,
  food_preference VARCHAR(50),
  food_allergies TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

INSERT INTO admins (username, email, password)
VALUES
  ('admin', 'admin@sspg.com', 'admin123')
ON DUPLICATE KEY UPDATE email = email;

INSERT INTO students (registration_no, name, email, phone, password)
VALUES
  ('S1001', 'Aman Kumar', 'aman@example.com', '9876543210', 'student123'),
  ('S1002', 'Rohit Singh', 'rohit@example.com', '9876501234', 'student123')
ON DUPLICATE KEY UPDATE email = email;

INSERT INTO rooms (room_number, room_type, capacity, price)
VALUES
  ('R001', 'shared', 5, 78000.00),
  ('R002', 'shared', 5, 78000.00),
  ('R003', 'shared', 5, 102000.00)
ON DUPLICATE KEY UPDATE room_type = VALUES(room_type), capacity = VALUES(capacity), price = VALUES(price);

INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B1'), 'available' FROM rooms r WHERE r.room_number = 'R001' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B2'), 'available' FROM rooms r WHERE r.room_number = 'R001' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B3'), 'available' FROM rooms r WHERE r.room_number = 'R001' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B4'), 'available' FROM rooms r WHERE r.room_number = 'R001' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B5'), 'available' FROM rooms r WHERE r.room_number = 'R001' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B1'), 'available' FROM rooms r WHERE r.room_number = 'R002' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B2'), 'available' FROM rooms r WHERE r.room_number = 'R002' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B3'), 'available' FROM rooms r WHERE r.room_number = 'R002' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B4'), 'available' FROM rooms r WHERE r.room_number = 'R002' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B5'), 'available' FROM rooms r WHERE r.room_number = 'R002' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B1'), 'available' FROM rooms r WHERE r.room_number = 'R003' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B2'), 'available' FROM rooms r WHERE r.room_number = 'R003' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B3'), 'available' FROM rooms r WHERE r.room_number = 'R003' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B4'), 'available' FROM rooms r WHERE r.room_number = 'R003' ON DUPLICATE KEY UPDATE status = VALUES(status);
INSERT INTO beds (room_id, bed_label, status)
SELECT r.id, CONCAT(r.room_number, '-B5'), 'available' FROM rooms r WHERE r.room_number = 'R003' ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO bookings (student_id, bed_id, status, notes)
VALUES
  (1, NULL, 'pending', 'Needs ground-floor room'),
  (2, NULL, 'allocated', 'Wants near study room');

INSERT INTO inquiries (student_id, subject, message, status)
VALUES
  (1, 'Room temperature', 'My room is too cold at night.', 'open'),
  (2, 'Late fee', 'How much extra fee for late payment?', 'answered');

INSERT INTO payments (student_id, booking_id, amount, payment_status, due_date, paid_at)
VALUES
  (1, 1, 15000.00, 'pending', DATE_ADD(CURDATE(), INTERVAL 7 DAY), NULL),
  (2, 2, 15000.00, 'paid', DATE_ADD(CURDATE(), INTERVAL 7 DAY), NOW())
ON DUPLICATE KEY UPDATE payment_status = VALUES(payment_status);

INSERT INTO sms_notifications (student_id, admin_id, booking_id, subject, message, status)
VALUES
  (1, 1, 1, 'Booking confirmation', 'Your booking request has been received.', 'sent'),
  (2, 1, 2, 'Payment received', 'Your payment has been recorded successfully.', 'sent');

-- Gallery Table for Image Management
CREATE TABLE IF NOT EXISTS gallery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  image_base64 LONGTEXT,
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_display_order (display_order),
  INDEX idx_is_visible (is_visible)
);

-- Feedbacks Table for Student Testimonials
CREATE TABLE IF NOT EXISTS feedbacks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT,
  student_name VARCHAR(150) NOT NULL,
  student_email VARCHAR(150) NOT NULL,
  rating INT DEFAULT 5,
  message TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  INDEX idx_is_visible (is_visible),
  INDEX idx_created_at (created_at)
);

-- Insert sample gallery images
INSERT INTO gallery (title, description, image_url, display_order, is_visible)
VALUES
  ('Premium Room', 'Spacious and well-lit single occupancy room', 'https://images.unsplash.com/photo-1522771731470-ea814e82001d?auto=format&fit=crop&q=80', 1, TRUE),
  ('Dining Area', 'Modern dining area with hygienic food preparation', 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&q=80', 2, TRUE),
  ('Study Area', 'Quiet study room with good ventilation', 'https://images.unsplash.com/photo-1581428982868-e410dd98fc1c?auto=format&fit=crop&q=80', 3, TRUE),
  ('Common Room', 'Cozy and comfortable common area', 'https://images.unsplash.com/photo-1502672260266-1c1e525def50?auto=format&fit=crop&q=80', 4, TRUE)
ON DUPLICATE KEY UPDATE display_order = VALUES(display_order);

-- Insert sample testimonials
INSERT INTO feedbacks (student_name, student_email, rating, message, is_visible)
VALUES
  ('Aditya Sharma', 'aditya@example.com', 5, 'Premium Amenities & Security - Shree Samarth PG offers exceptional living with high-speed Wi-Fi, daily housekeeping, 24/7 security, and hygienic food. It feels just like a home away from home.', TRUE),
  ('Rahul Patil', 'rahul@example.com', 5, 'Perfect Location for Students - The location is incredibly convenient, right near major colleges and transport hubs. The quiet environment makes it perfectly suited for students who need to focus on their studies.', TRUE),
  ('Vikram Singh', 'vikram@example.com', 5, 'Clean & Spacious Rooms - I have been staying here for six months, and the rooms are always kept spotless. The storage space is ample, and the ventilation is great, making it very comfortable.', TRUE),
  ('Neha Deshmukh', 'neha@example.com', 5, 'Great Community Vibe - Beyond the great facilities, the atmosphere here is very welcoming. The common areas allow everyone to interact comfortably, making it easy to make good friends here.', TRUE)
ON DUPLICATE KEY UPDATE message = VALUES(message);
