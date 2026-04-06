/**
 * /start — 짧은 진입 별칭, /workflow로 리디렉션
 *
 * 사용자가 "시작하기"라고 검색하거나 명함/홍보물에 짧은 URL이 필요할 때 사용.
 */
import { redirect } from 'next/navigation';

export default function StartPage() {
  redirect('/workflow');
}
