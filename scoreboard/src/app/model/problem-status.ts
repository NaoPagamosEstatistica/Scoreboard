import { Submission } from './submission';

export class ProblemStatus {
  problemId: number;
  submissions: Submission[];

  constructor(problemId: number, submissions?: Submission[]) {
    this.problemId = problemId;
    this.submissions = new Array();
    if (submissions) this.addSubmissions(submissions);
  }

  addSubmissions(submissions: Submission[]) {
    submissions.forEach(s => {
      this.submissions.push(s);
    });
  }

  static toString(ps: ProblemStatus) {
    if (ps.submissions.length == 0)
      return '-';
    if (ps.submissions[ps.submissions.length - 1].verdict == 'accepted')
      return '✔ ' + (ps.submissions.length > 1 ? ps.submissions.length.toString() : '');
    return '❌ ' + ps.submissions.length.toString();
  }

  toString() {
    if (this.submissions.length == 0)
      return '-';
    if (this.submissions[this.submissions.length - 1].verdict == 'accepted')
      return '✔ ' + (this.submissions.length > 1 ? this.submissions.length.toString() : '');
    return '❌ ' + this.submissions.length.toString();
  }
}
