-- 문의 접수 테이블
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, replied, closed
  admin_reply text,
  created_at timestamptz DEFAULT now(),
  replied_at timestamptz
);

-- RLS
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

-- 서비스 역할만 접근
CREATE POLICY "service_role_all" ON contact_inquiries
  FOR ALL USING (true) WITH CHECK (true);
