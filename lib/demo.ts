import { Analysis, Source, Task, levels } from './schema';

export const demoSources: Source[] = [
  { id: 'demo-1', filename: 'Bloom CS field notes (built-in demo)', page: 1, exam: false, text: 'A stack uses last in, first out (LIFO). A queue uses first in, first out (FIFO). An array provides constant-time indexed access. A linked list requires linear-time indexed access, but insertion at a known node can be constant time.' },
  { id: 'demo-2', filename: 'Bloom CS field notes (built-in demo)', page: 2, exam: false, text: 'Binary search requires sorted data. Compare the target to the midpoint, then discard the half that cannot contain it. Each iteration halves the search interval, giving O(log n) time. With inclusive bounds, set low = mid + 1 or high = mid - 1 to ensure progress.' },
  { id: 'demo-3', filename: 'Bloom CS field notes (built-in demo)', page: 3, exam: false, text: 'A hash table maps keys to buckets using a hash function. With a good hash function and controlled load factor, lookup is expected O(1). Collisions occur when keys map to the same bucket. Chaining stores multiple entries per bucket. Worst-case lookup is O(n).' },
  { id: 'demo-4', filename: 'Bloom CS field notes (built-in demo)', page: 4, exam: false, text: 'Big O describes an asymptotic upper bound on growth. Two independent nested loops of n iterations each perform n squared operations, O(n^2). Consecutive linear loops take O(n) total time. A loop that doubles its index takes O(log n) iterations. A frequency map can trade O(n) extra space for expected O(n) time.' },
];
const cite = (page: number) => [{ sourceId: `demo-${page}`, quote: demoSources[page - 1].text.split('. ')[0] }];
const topics = [
  { id: 'structures', name: 'Data structures', objective: 'Choose a structure based on access and ordering needs.', weight: 17, citations: cite(1), lectureOrder: 1, lectureTag: 'Lecture 01 · Primitives' },
  { id: 'binary', name: 'Binary search', objective: 'Trace a shrinking search interval and reason about boundaries.', weight: 33, citations: cite(2), lectureOrder: 2, lectureTag: 'Lecture 02 · Search' },
  { id: 'hash', name: 'Hash tables', objective: 'Explain collisions and distinguish expected from worst-case lookup.', weight: 33, citations: cite(3), lectureOrder: 3, lectureTag: 'Lecture 03 · Hashing' },
  { id: 'complexity', name: 'Algorithm complexity', objective: 'Compare growth rates and time–space tradeoffs.', weight: 17, citations: cite(4), lectureOrder: 4, lectureTag: 'Lecture 04 · Analysis' },
];
function q(id: string, topicId: string, prompt: string, options: string[], answer: number, explanation: string, page: number) {
  return { id, topicId, prompt, options, answer, explanation, difficulty: 'Intermediate' as const, citations: cite(page) };
}
export const demoAnalysis: Analysis = {
  summary: 'Four connected ideas, one clearer picture. Explore how data structures shape the way we search, store, and reason about efficiency.',
  examInsight: 'Built-in demo blueprint: 2 binary search questions, 2 hash table questions, 1 data structures question, and 1 complexity question. Both assessments use intermediate difficulty. No uploaded files are used.',
  topics,
  diagnostic: [
    q('d1', 'structures', 'Which structure naturally models an undo history, where the most recent action is reversed first?', ['Queue', 'Stack', 'Sorted array', 'Hash table'], 1, 'A stack is last in, first out: the most recent action is removed first.', 1),
    q('d2', 'binary', 'What must be true before ordinary binary search can correctly search an array?', ['All values are unique', 'Its length is a power of two', 'Its values are sorted', 'It contains only integers'], 2, 'Sorted order lets a midpoint comparison eliminate an entire half of the array.', 2),
    q('d3', 'hash', 'With a good hash function and a controlled load factor, what is the expected lookup time in a hash table?', ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], 0, 'A well-distributed hash function keeps the expected number of entries examined per lookup bounded.', 3),
    q('d4', 'complexity', 'Two nested loops each run n times, independently of the other. What is the time complexity?', ['O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'], 3, 'Each of n outer iterations performs n inner iterations: n × n operations.', 4),
    q('d5', 'binary', 'With inclusive bounds, the midpoint value is less than the target. Which update guarantees progress?', ['low = mid', 'low = mid + 1', 'high = mid + 1', 'high = mid'], 1, 'The midpoint has been ruled out, so move the lower bound past it to mid + 1.', 2),
    q('d6', 'hash', 'If every key maps to the same bucket in a hash table using chaining, what is the worst-case lookup time?', ['O(1)', 'O(log n)', 'O(n log n)', 'O(n)'], 3, 'A lookup may scan the entire chain of n entries.', 3),
  ],
  final: [
    q('f1', 'structures', 'A printer should process jobs in the order they arrive. Which structure best fits?', ['Stack', 'Queue', 'Binary search tree', 'Unordered set'], 1, 'A queue is first in, first out, matching arrival order.', 1),
    q('f2', 'binary', 'Binary search repeatedly halves a sorted array of n elements. How does its worst-case number of comparisons grow?', ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'], 2, 'Repeated halving reaches a single element after roughly log₂ n steps.', 2),
    q('f3', 'hash', 'Two different usernames hash to the same bucket. What is this called?', ['A collision', 'A recursive call', 'A sort', 'A cache hit'], 0, 'A collision occurs when distinct keys map to the same bucket; chaining is one resolution strategy.', 3),
    q('f4', 'complexity', 'An algorithm scans n items once, then scans them again in a separate loop. What is its time complexity?', ['O(n²)', 'O(log n)', 'O(n log n)', 'O(n)'], 3, 'The work is n + n = 2n. Big O drops constant factors, leaving O(n).', 4),
    q('f5', 'binary', 'In inclusive-bound binary search, the midpoint value is greater than the target. What is the correct next upper bound?', ['mid', 'mid - 1', 'mid + 1', 'low + 1'], 1, 'The midpoint is too large and can be excluded, so high becomes mid - 1.', 2),
    q('f6', 'hash', 'Which statement most accurately describes hash table lookup?', ['Always O(1)', 'Always O(log n)', 'Expected O(n), worst-case O(1)', 'Expected O(1), worst-case O(n)'], 3, 'Good distribution supports expected constant time, but extreme collisions can require scanning n entries.', 3),
  ],
};
const banks: Record<string, { teaching: string; prompts: string[]; answers: string[]; rubrics: string[][]; hint: string; page: number }> = {
  binary: {
    teaching: 'Binary search uses sorted order to discard half the candidates at each step. With inclusive bounds, exclude the midpoint after an unsuccessful comparison. The shrinking interval gives logarithmic time.',
    prompts: ['Name the prerequisite for binary search and its time complexity.', 'Explain in your own words why binary search can discard half of the remaining values.', 'Search [2, 5, 8, 12, 16, 23, 38] for 23. List the midpoint values examined, using floor((low + high) / 2).', 'Compare linear and binary search. How do sorted order and interval size affect their work?', 'A solution uses low = mid when the target is greater than the midpoint. Critique this update and suggest a correction.', 'Design a binary search for a sorted list of book IDs. Describe the bounds, midpoint comparison, updates, and stopping condition.'],
    answers: ['The data must be sorted; binary search takes O(log n) time.', 'Sorted order means all values to one side of the midpoint are too small or too large. Removing that half preserves possible matches.', 'Start at index 3, value 12. Since 23 > 12, low = 4. The next midpoint is index 5, value 23: found.', 'Linear search checks one item at a time, O(n), without requiring sorted order. Binary search needs sorted order and halves the remaining interval, O(log n).', 'low = mid can leave the interval unchanged when low equals mid. Use low = mid + 1 to exclude the checked midpoint and guarantee termination.', 'Set low = 0 and high = length - 1. While low <= high, compare the midpoint ID. Return on a match; otherwise set low = mid + 1 or high = mid - 1. Return not found when the interval is empty.'],
    rubrics: [['States sorted order', 'Identifies logarithmic time'], ['Uses sorted order', 'Explains eliminating half'], ['Examines 12 then 23', 'Explains the lower-bound update'], ['Contrasts linear and logarithmic work', 'Notes the sorted prerequisite'], ['Identifies possible nontermination', 'Corrects to mid + 1'], ['Defines bounds and comparisons', 'Ensures progress and a stopping condition']], hint: 'Think about what the midpoint comparison proves about all the values to its left or right.', page: 2,
  },
  hash: {
    teaching: 'Hash tables turn a key into a bucket location. Good distribution keeps expected lookup constant, but collisions must be handled. Chaining groups colliding entries; a long chain can make worst-case lookup linear.',
    prompts: ['Recall the expected and worst-case lookup time of a hash table.', 'Explain a hash collision and how chaining handles it, in your own words.', 'Keys 12, 22, and 35 use h(k) = k mod 10. Assign buckets and describe any collision.', 'Compare a hash table with a sorted array for exact-key lookup. Discuss both time and assumptions.', 'Critique the claim: “Hash tables always guarantee O(1) lookup.” Give a counterexample.', 'Design a word-frequency counter using a hash table. Describe updates, output, and time and space costs.'],
    answers: ['Expected O(1), worst-case O(n).', 'A collision puts distinct keys in the same bucket. Chaining stores them together and checks keys within that bucket.', '12 and 22 both map to bucket 2 and collide; 35 maps to bucket 5. Chaining retains both colliding keys in bucket 2.', 'A hash table gives expected O(1) exact lookup with good distribution, worst-case O(n). A sorted array supports O(log n) binary search and needs sorted order.', 'The guarantee is false. If all n keys collide in one bucket, searching a chain can take O(n). O(1) is an expected bound with good distribution and controlled load.', 'For each word, increment its map entry or initialize it to 1. Output key/count pairs. For n words and k distinct words, expected time is O(n) and extra space is O(k).'],
    rubrics: [['States expected O(1)', 'States worst-case O(n)'], ['Defines collision between distinct keys', 'Explains storing and checking a chain'], ['Maps 12 and 22 to bucket 2', 'Maps 35 to bucket 5 and handles collision'], ['Contrasts expected and worst-case lookup', 'States sorted array assumption'], ['Rejects an unconditional guarantee', 'Gives a collision counterexample'], ['Describes increment or initialize', 'Justifies time and space costs']], hint: 'Consider two different keys with the same bucket, and what happens if that bucket gets very long.', page: 3,
  },
  structures: {
    teaching: 'Choose a data structure around the operations you need. Stacks remove the newest item first; queues remove the oldest. Arrays make indexed access fast. Linked lists support cheap insertion at a known node but require traversal for indexed access.',
    prompts: ['Recall what LIFO and FIFO mean and name a structure for each.', 'Explain why a queue fits a first-come, first-served help desk.', 'Push A, B, and C onto a stack, then pop twice. What is removed, and what remains?', 'Compare array and linked-list indexed access. Why do their costs differ?', 'Someone proposes a stack for a fair arrival-order waiting line. Critique the choice and recommend a structure.', 'Design a simple editor undo system using a data structure. Describe how edits are saved and reversed.'],
    answers: ['LIFO is last in, first out: stack. FIFO is first in, first out: queue.', 'A queue removes the earliest arriving item first, preserving arrival order and preventing new arrivals from jumping ahead.', 'C is popped first, then B. A remains on the stack.', 'An array calculates an index location in O(1). A linked list follows links from the beginning, requiring O(n) in general.', 'A stack serves the newest arrival first and can keep older people waiting. A FIFO queue preserves arrival order.', 'Push each action and its inverse onto a stack. Undo pops the newest action and applies its inverse, reversing edits in last-in, first-out order.'],
    rubrics: [['Associates stack with LIFO', 'Associates queue with FIFO'], ['Preserves arrival order', 'Connects dequeue to earliest arrival'], ['Pops C then B', 'Leaves A'], ['States constant array access', 'Explains linear list traversal'], ['Identifies reversed arrival order', 'Recommends FIFO queue'], ['Stores reversible actions', 'Uses last-in, first-out undo']], hint: 'Ask whether the oldest or newest item should be processed next.', page: 1,
  },
  complexity: {
    teaching: 'Count how work grows with input size. Separate loops add their costs; independent nested loops multiply. Big O omits constant factors. An auxiliary map can reduce repeated scanning at the expense of extra memory.',
    prompts: ['Recall the Big O cost of a single n-step loop and two independent nested n-step loops.', 'Explain why two consecutive n-step loops are O(n), not O(n²).', 'An outer loop runs n times and an inner loop runs 5 times. Derive the total work and Big O.', 'Compare a loop that increments its index with one that doubles it. Explain the growth in iterations.', 'Critique: “An O(n) algorithm is always faster than an O(n²) algorithm.” Discuss the limits of asymptotic comparisons.', 'Design an approach to detect duplicates with a hash set. Explain expected time, extra space, and the tradeoff versus comparing every pair.'],
    answers: ['One n-step loop is O(n). Two independent nested n-step loops are O(n²).', 'The loops execute one after another, giving n + n = 2n operations, which is O(n) after dropping constants.', 'There are 5n operations. Since 5 is constant, the time is O(n).', 'Incrementing takes O(n) steps. Doubling reaches n in O(log n) steps because the index grows exponentially.', 'Big O describes asymptotic growth, not exact runtime for every input. Constants and small input sizes can reverse actual timings.', 'Scan values and check a hash set. Return true for a value already present; otherwise add it. Expected O(n) time and O(n) space, versus O(n²) pair comparisons with constant extra space.'],
    rubrics: [['Identifies linear cost', 'Identifies quadratic nested cost'], ['Adds rather than multiplies', 'Drops constant factor'], ['Counts 5n operations', 'Simplifies to O(n)'], ['Explains incremental linear growth', 'Explains doubling logarithmic growth'], ['Distinguishes growth from exact runtime', 'Mentions constants or input size'], ['Checks and inserts into a set', 'Explains time–space tradeoff']], hint: 'Count total operations first, then keep the fastest-growing term and drop constant factors.', page: 4,
  },
};
const formatOptions: Record<string, {
  mcqOptions: string[][];
  blankTemplates: string[];
  matchingPairs: { left: string; right: string }[][];
}> = {
  binary: {
    mcqOptions: [
      ['The data must be sorted; running time is O(log n)', 'The data can be unsorted; running time is O(n)', 'The data must be a linked list; running time is O(1)', 'The data must contain unique powers of two; running time is O(n²)'],
      ['Sorted order allows eliminating half the elements each step', 'All elements must be powers of two', 'Binary search tests every index in linear sequence', 'Hash values must match bucket indexes'],
      ['Floor((low + high) / 2) determines the midpoint', 'Index values are multiplied together', 'The target is inserted into a new bucket', 'Linear scan checks low and high simultaneously'],
      ['Linear search is O(n) without sorted order; binary search needs sorted order and halves intervals in O(log n)', 'Linear search is always faster than binary search', 'Both algorithms require strictly sorted inputs', 'Binary search uses O(n) extra space per comparison'],
      ['low = mid risks infinite loop; use low = mid + 1 to guarantee progress', 'low = mid is always optimal and terminates fastest', 'high should be set to 0 instead of updating low', 'The loop should terminate without inspecting the target'],
      ['Set low = 0, high = len - 1, compare midpoint, and update bounds', 'Scan from low to high one index at a time', 'Compute hash of book ID and check bucket 0', 'Pop book IDs from a LIFO stack until empty']
    ],
    blankTemplates: [
      'Binary search requires that the input array be [sorted] and executes with [O(log n)] time complexity.',
      'Because elements are sorted, comparing against the midpoint eliminates [half] of the remaining search interval.',
      'When searching for 23, the first midpoint evaluated is value [12], which moves the lower bound to index [4].',
      'While linear search runs in O(n) time, binary search achieves logarithmic growth of [O(log n)].',
      'To prevent non-termination when target > mid, the lower bound must advance to [mid + 1].',
      'A complete binary search terminates when low is [greater than] high and the target has not been found.'
    ],
    matchingPairs: [
      [
        { left: 'Sorted Order', right: 'Prerequisite for halving interval' },
        { left: 'O(log n)', right: 'Logarithmic running time' },
        { left: 'Midpoint Comparison', right: 'Eliminates half of values' }
      ],
      [
        { left: 'Ascending Order', right: 'Values left of mid are smaller' },
        { left: 'Discarding Half', right: 'Preserves potential matches' },
        { left: 'Halving Steps', right: 'Interval size drops from n to n/2' }
      ],
      [
        { left: 'Step 1: Check Index 3', right: 'Value is 12 (less than 23)' },
        { left: 'Lower Bound Update', right: 'Advance low to index 4' },
        { left: 'Step 2: Check Index 5', right: 'Value is 23: target found!' }
      ],
      [
        { left: 'Linear Search', right: 'O(n) time on unsorted data' },
        { left: 'Binary Search', right: 'O(log n) time on sorted data' },
        { left: 'Interval Halving', right: 'Scales to massive collections' }
      ],
      [
        { left: 'Buggy Update', right: 'low = mid may loop infinitely' },
        { left: 'Corrected Update', right: 'low = mid + 1 guarantees progress' },
        { left: 'Invariant', right: 'Interval strictly shrinks each loop' }
      ],
      [
        { left: 'Initial State', right: 'low = 0, high = length - 1' },
        { left: 'Loop Condition', right: 'While low <= high' },
        { left: 'Midpoint Test', right: 'mid = floor((low + high) / 2)' }
      ]
    ]
  },
  hash: {
    mcqOptions: [
      ['Expected O(1) lookup, worst-case O(n) lookup', 'Always O(log n) lookup', 'Expected O(n) lookup, worst-case O(1) lookup', 'Always O(n²) lookup'],
      ['A collision puts distinct keys in the same bucket; chaining stores them in that bucket', 'A collision occurs when keys are sorted into ascending order', 'A collision forces the table to delete all entries', 'A collision requires recreating the hash function'],
      ['Keys 12 and 22 map to bucket 2 and collide; 35 maps to bucket 5', 'All three keys map to bucket 0', '12 maps to 1, 22 maps to 2, 35 maps to 3', 'Key 35 cannot be hashed'],
      ['Hash table gives expected O(1) lookup; sorted array supports O(log n) binary search', 'Sorted arrays give O(1) expected lookup', 'Hash tables require sorted keys', 'Both require linear scan for every query'],
      ['False: extreme collisions can degrade chain lookup to O(n)', 'True: hash tables mathematically guarantee O(1) in all cases', 'False: lookup is always O(n²)', 'True: chaining eliminates worst-case time entirely'],
      ['Increment key count in map or initialize to 1; expected O(n) time', 'Sort words first in O(n log n) then scan', 'Store all words in a single bucket', 'Rehash after every individual word']
    ],
    blankTemplates: [
      'A hash table achieves expected [O(1)] lookup time, but worst-case lookup can degrade to [O(n)].',
      'When two distinct keys produce the same hash bucket, a [collision] occurs, resolved by [chaining].',
      'With h(k) = k mod 10, keys 12 and 22 both map to bucket [2] and collide.',
      'Unlike a sorted array requiring O(log n) time, a hash table offers expected [O(1)] time.',
      'The claim of guaranteed O(1) is false because if all keys hash to one bucket, searching takes [O(n)].',
      'For counting word frequencies, an entry is initialized to 1 or incremented, yielding expected [O(n)] time.'
    ],
    matchingPairs: [
      [
        { left: 'Expected Lookup', right: 'O(1) constant time with uniform hash' },
        { left: 'Worst-Case Lookup', right: 'O(n) linear time when all collide' },
        { left: 'Hash Function', right: 'Maps keys to bucket locations' }
      ],
      [
        { left: 'Collision Event', right: 'Two distinct keys mapping to same bucket' },
        { left: 'Chaining Technique', right: 'Stores colliding entries in bucket list' },
        { left: 'Load Factor', right: 'Ratio of stored items to bucket count' }
      ],
      [
        { left: '12 mod 10 & 22 mod 10', right: 'Both equal bucket 2 (collision)' },
        { left: '35 mod 10', right: 'Maps to bucket 5' },
        { left: 'Bucket 2 Resolution', right: 'Contains both keys 12 and 22' }
      ],
      [
        { left: 'Hash Table', right: 'Expected O(1), no sorting required' },
        { left: 'Sorted Array', right: 'O(log n) lookup, requires sorted keys' },
        { left: 'Collision Degradation', right: 'Hash table degrades to O(n) in worst case' }
      ],
      [
        { left: 'Unconditional O(1) claim', right: 'False: subject to worst-case collisions' },
        { left: 'Counterexample', right: 'All n keys hashing to identical bucket' },
        { left: 'Resolution Strategy', right: 'Resize table and rehash entries' }
      ],
      [
        { left: 'New Word', right: 'Initialize map entry with count = 1' },
        { left: 'Existing Word', right: 'Increment entry count by 1' },
        { left: 'Complexity', right: 'Expected O(n) total time and O(k) space' }
      ]
    ]
  },
  structures: {
    mcqOptions: [
      ['Stack uses LIFO (last in first out); Queue uses FIFO (first in first out)', 'Stack uses FIFO; Queue uses LIFO', 'Both Stack and Queue use LIFO', 'Array uses FIFO; Linked List uses LIFO'],
      ['A queue serves the earliest arrival first, preserving arrival order', 'A queue sorts requests by user priority', 'A queue reverses the order of tickets', 'A queue performs O(1) random access'],
      ['C is popped first, then B; A remains on the stack', 'A is popped first, then B; C remains', 'All three items are removed together', 'B is popped first, then C; A remains'],
      ['Arrays compute index address in O(1); linked lists traverse nodes in O(n)', 'Linked lists provide O(1) random indexing', 'Arrays require O(n) traversal for indexing', 'Both provide identical O(1) index performance'],
      ['A stack serves newest arrivals first; a FIFO queue is fair for waiting lines', 'A stack is fair because it operates in LIFO order', 'A hash table is required for any waiting line', 'Queues cause indefinite delays for all arrivals'],
      ['Push actions and inverse onto stack; undo pops newest and reverses it', 'Use a queue to undo oldest actions first', 'Store all actions in an unsorted array', 'Delete history on every action']
    ],
    blankTemplates: [
      'A stack operates on a [LIFO] discipline, whereas a queue operates on a [FIFO] discipline.',
      'A queue is ideal for a help desk because dequeueing removes the [earliest] arrival first.',
      'After pushing A, then B, then C onto a stack, popping twice removes [C then B], leaving [A].',
      'Direct index access takes [O(1)] time in an array, but takes [O(n)] time in a linked list.',
      'Using a stack for a line is unfair because the [newest] arrival is served first; use a [queue].',
      'An undo mechanism naturally fits a [stack] because the newest edit is reversed first.'
    ],
    matchingPairs: [
      [
        { left: 'Stack Discipline', right: 'LIFO: Last In, First Out' },
        { left: 'Queue Discipline', right: 'FIFO: First In, First Out' },
        { left: 'Stack Operations', right: 'Push and Pop' }
      ],
      [
        { left: 'Enqueue', right: 'Add to tail of queue' },
        { left: 'Dequeue', right: 'Remove earliest arrival from head' },
        { left: 'Order Preservation', right: 'First-come, first-served guarantee' }
      ],
      [
        { left: 'Top of Stack', right: 'Item C after pushing A, B, C' },
        { left: 'First Pop', right: 'Removes item C' },
        { left: 'Second Pop', right: 'Removes item B (leaving A)' }
      ],
      [
        { left: 'Array Indexing', right: 'O(1) direct address arithmetic' },
        { left: 'Linked List Indexing', right: 'O(n) sequential pointer traversal' },
        { left: 'Node Insertion', right: 'O(1) at known pointer' }
      ],
      [
        { left: 'Stack in Waiting Line', right: 'Unfair: newest arrival served first' },
        { left: 'Queue in Waiting Line', right: 'Fair: preserves chronological order' },
        { left: 'Starvation Risk', right: 'Older arrivals wait indefinitely in stack' }
      ],
      [
        { left: 'Perform Edit', right: 'Push action and inverse onto undo stack' },
        { left: 'Undo Request', right: 'Pop topmost action and execute inverse' },
        { left: 'Undo Order', right: 'Last-in, first-out reversal' }
      ]
    ]
  },
  complexity: {
    mcqOptions: [
      ['Single loop is O(n); independent nested loops are O(n²)', 'Single loop is O(1); nested loops are O(n)', 'Single loop is O(n²); nested loops are O(n³)', 'Both take O(n log n) time'],
      ['Sequential loops add operations (n + n = 2n), which simplifies to O(n)', 'Sequential loops multiply operations (n × n = n²)', 'Sequential loops run simultaneously in O(1)', 'Constants are never dropped in asymptotic analysis'],
      ['5n total operations, which simplifies to O(n) because 5 is constant', '5n operations simplifies to O(n²)', 'The inner loop makes it O(log n)', 'The runtime is O(5ⁿ)'],
      ['Doubling index reaches n in O(log n) steps; incrementing takes O(n) steps', 'Doubling index takes O(n²) steps', 'Incrementing index is always logarithmic', 'Both require identical numbers of iterations'],
      ['Big O describes asymptotic growth for large n; constants and small n can make O(n²) faster', 'O(n) is guaranteed faster for all possible inputs', 'Asymptotic bounds determine exact nanosecond timings', 'Input size has no impact on algorithm performance'],
      ['Hash set yields expected O(n) time and O(n) space; pairs comparison takes O(n²) with O(1) space', 'Both approaches take O(n log n) time and O(1) space', 'Hash set takes O(n²) time', 'Pair comparisons take O(1) time']
    ],
    blankTemplates: [
      'A single n-iteration loop runs in [O(n)] time, while two nested loops run in [O(n²)] time.',
      'Two consecutive loops execute n + n = 2n operations, simplifying to [O(n)] by dropping constants.',
      'An outer loop of n steps and an inner loop of 5 steps performs 5n operations, order [O(n)].',
      'An index that doubles at each step reaches n in [O(log n)] steps, whereas incrementing takes [O(n)].',
      'Big O characterizes [asymptotic] growth, meaning for small inputs an O(n²) code might be [faster].',
      'Using a hash set to detect duplicates trades [O(n) extra memory] for [O(n) expected time].'
    ],
    matchingPairs: [
      [
        { left: 'Single Loop', right: 'O(n) linear growth' },
        { left: 'Two Nested Loops', right: 'O(n²) quadratic growth' },
        { left: 'Big O Definition', right: 'Asymptotic upper bound ignoring constants' }
      ],
      [
        { left: 'Consecutive Loops', right: 'Costs add: n + n = 2n' },
        { left: 'Nested Loops', right: 'Costs multiply: n × n = n²' },
        { left: 'Dropping Constants', right: '2n simplifies to O(n)' }
      ],
      [
        { left: 'Outer Loop: n', right: 'Runs n iterations' },
        { left: 'Inner Loop: 5', right: 'Runs constant 5 iterations' },
        { left: 'Total Operations', right: '5n operations = O(n) linear' }
      ],
      [
        { left: 'Incrementing (i++)', right: 'Takes n steps (linear growth)' },
        { left: 'Doubling (i *= 2)', right: 'Takes log₂ n steps (logarithmic growth)' },
        { left: 'Exponential Leap', right: 'Multiplicative leaps cut step count' }
      ],
      [
        { left: 'Asymptotic Growth', right: 'Describes scaling behavior for large n' },
        { left: 'Constant Factors', right: 'Can dominate runtime on small inputs' },
        { left: 'Empirical Tuning', right: 'Simpler code may win when n is small' }
      ],
      [
        { left: 'Brute Force Duplicate Check', right: 'O(n²) time with O(1) auxiliary space' },
        { left: 'Hash Set Duplicate Check', right: 'Expected O(n) time with O(n) space' },
        { left: 'Space-Time Tradeoff', right: 'Consuming memory to accelerate computation' }
      ]
    ]
  }
};

const defaultFormats: ('mcq' | 'fill-blank' | 'matching' | 'mcq' | 'frq' | 'frq')[] = [
  'mcq',
  'fill-blank',
  'matching',
  'mcq',
  'frq',
  'frq'
];

export function demoTasks(priorities: string[]): Task[] {
  // The weakest topic receives three levels; each other CS topic receives one.
  const order = [0, 0, 1, 2, 3, 0];
  return levels.map((level, i) => {
    const topicId = priorities[order[i]] ?? priorities[0];
    const bank = banks[topicId];
    const fmt = formatOptions[topicId] || formatOptions.binary;
    return {
      id: `task-${i}`,
      topicId,
      level,
      format: defaultFormats[i],
      teaching: bank.teaching,
      prompt: bank.prompts[i],
      hint: bank.hint,
      modelAnswer: bank.answers[i],
      rubric: bank.rubrics[i],
      citations: cite(bank.page),
      mcqOptions: fmt.mcqOptions[i],
      blankTemplate: fmt.blankTemplates[i],
      matchingPairs: fmt.matchingPairs[i]
    };
  });
}
