-- 011: DELETE RLS 정책 추가
-- business_plans, plan_sections, ir_presentations, ir_slides, company_documents, assistant_chats
-- 기존에 SELECT/INSERT/UPDATE만 있고 DELETE 정책이 누락되어 삭제가 작동하지 않던 문제 수정

-- 사업계획서 삭제
CREATE POLICY "Users can delete own plans" ON business_plans FOR DELETE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- 섹션 삭제
CREATE POLICY "Users can delete own sections" ON plan_sections FOR DELETE
  USING (plan_id IN (SELECT id FROM business_plans WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())));

-- IR 프레젠테이션 삭제
CREATE POLICY "Users can delete own ir" ON ir_presentations FOR DELETE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- IR 슬라이드 삭제
CREATE POLICY "Users can delete own slides" ON ir_slides FOR DELETE
  USING (presentation_id IN (SELECT id FROM ir_presentations WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())));

-- 서류 삭제
CREATE POLICY "Users can delete own documents" ON company_documents FOR DELETE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- 채팅 삭제
CREATE POLICY "Users can delete own chats" ON assistant_chats FOR DELETE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
