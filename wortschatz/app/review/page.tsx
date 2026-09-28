import { redirect } from "next/navigation";

// 복습은 퀴즈 화면으로 통합되었다. 예전 주소로 들어와도 퀴즈로 이동시킨다.
export default function ReviewRedirect() {
  redirect("/quiz");
}
