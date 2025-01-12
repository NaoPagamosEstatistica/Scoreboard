import { Competidor } from './competidor';
import { Problem } from './problem';

export class Competition {
  id: number;
  name: string;
  startTime: Date;
  endTime: Date;
  competidors: Competidor[];
  problems: Problem[];

  constructor(id: number, name: string, startTime: Date = new Date(), endTime: Date = new Date(), competidors: Competidor[] = new Array(), problems: Problem[] = new Array()) {
    this.id = id;
    this.name = name;
    this.startTime = startTime;
    this.endTime = endTime;
    this.competidors = competidors;
    this.problems = problems;
  }

  static parse(other: any) {
    other.startTime = new Date(other.startTime);
    other.endTime = new Date(other.endTime);
    return other;
  }
}
