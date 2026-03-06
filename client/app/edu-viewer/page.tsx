"use client";
import apiResponse from '../../public/api-response.json';
import api2Response from '../../public/api-2.json';
import api3Response from '../../public/api-3.json';
import { parseCanvasAnimation } from '@/utils/diagram-parser';
import { CanvasAnimationViewer } from '@/components/CanvasAnimationViewer';

export default function Home() {
  const slides = parseCanvasAnimation(apiResponse);
  const slides2 = parseCanvasAnimation(api2Response);
  const slides3 = parseCanvasAnimation(api3Response);
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4 md:p-12">
      <main className="flex w-full max-w-5xl flex-col items-center justify-center py-16 px-4 md:px-12 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 mb-8 text-center uppercase tracking-wider">
          Educative Canvas Animation
        </h1>

        <div className="w-full flex justify-center">
          <CanvasAnimationViewer slides={slides} />
        </div>
        <br></br>
        <div className="w-full flex justify-center">
          <CanvasAnimationViewer slides={slides2} />
        </div>
        <br></br>
        <div className="w-full flex justify-center">
          <CanvasAnimationViewer slides={slides3} />
        </div>
        <h2>Logic building and programming</h2><p>The foundation of successful programming is logic construction. This involves dividing the problem into smaller parts and determining their connections to reach a solution. This course emphasizes this skill in addition to programming itself. Once the logic is established, the output is a set of instructions, expressed as code, that a computer can follow to perform a task. </p><h2>Strengths of this course</h2><p>This course offers detailed introductions for each problem, including a visual representation of how the code works, using animations, basic guidelines to solve each problem, and some real-world applications. These introductions will broaden your understanding of problem-solving techniques and equip you with the necessary skills to interpret distinguishing features of a problem that can help you identify its underlying logic.</p><p>Each lesson drills down to focus on the core of the programming problem at hand to present both the logic and multiple solutions. </p><ul><li><p>To ingrain the working of different programming constructs, we have written the solutions in an incremental approach, starting with a naive approach, then a better approach, followed by the best approach. The incremental approach ensures you understand why and how one approach is better. </p></li><li><p>There&#39;s a built-in debugger for you to execute the code line by line to investigate the values of variables and understand the execution flow.</p></li><li><p>We have also included multiple interactive elements, such as animations and illustrations, to help build your understanding of the problem. In the problems where we print different shapes, we use tables to identify patterns and construct an optimized solution.</p></li><li><p>We use a bottom-up approach to develop a step-by-step understanding of the problem. Illustrated examples help you visualize the input parameters and the corresponding output. Even the quizzes are designed to test and reinforce the understanding of the concepts. We encourage you to solve the problem by yourself, while explaining the solution in detail as well. Once you’ve clearly understood the problem, we provide the high-level, logical building blocks of the solution and then explain the fundamental details required to solve the problem step by step. </p></li></ul><h2>Course structure</h2><p>The lessons of this course can be divided into four categories:</p><ul><li><p>Problem-solving lessons: These lessons are a complete walkthrough of problems that are solved step by step and explained in detail with interactivity.</p></li><li><p>Challenge-solution review: The challenge lessons are meant to be solved by you and are followed by the solution review lessons.  </p></li><li><p>Hacker challenges: These are like problem-solving lessons, except they are slightly more complex. These lessons are optional, and you can skip them if you want.  </p></li><li><p>Practice exercise: These lessons have exercises that are meant to be solved by you and include their solutions as well. </p></li></ul><h2>Intended audience</h2><p>This course is for beginner programmers who are looking to take their programming knowledge to the next level.</p><h2>Prerequisites</h2><p>A good grasp of basic arithmetics is required.</p>
      </main>
    </div>
  );
}
