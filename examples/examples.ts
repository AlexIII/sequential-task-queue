import * as assert from "assert";
import { SequentialTaskQueue, CancellationToken, cancellationTokenReasons } from "../src/sequential-task-queue";
import * as sinon from "sinon";

describe("Examples", () => {
    describe("Basic usage", () => {
        it("", () => {
            var console = {
                log: sinon.spy()
            }
            // --- snippet: Basic usage ---
            var queue = new SequentialTaskQueue();
            queue.push(() => {
                console.log("first task");
            });
            queue.push(() => {
                console.log("second task");
            });
            // --- snip --- 
            
            return queue.wait().then(() => assert.deepEqual(console.log.args, [["first task"], ["second task"]]));
        });
    });

    describe("Promises", () => {
        it("", () => {
            var console = {
                log: sinon.spy()
            };
            // --- snippet: Promises  --- 
            var queue = new SequentialTaskQueue();
            queue.push(() => {
                console.log("1");
            });
            queue.push(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        console.log("2");
                        resolve();
                    }, 500);
                });
            });
            queue.push(() => {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        console.log("3");
                        reject();
                    }, 100);
                });
            });
            queue.push(() => {
                console.log("4");
            });

            // Output:
            // 1
            // 2
            // 3
            // 4

            // --- snip ---
            return queue.wait().then(() => assert.deepEqual(console.log.args, [["1"], ["2"], ["3"], ["4"]]));
        });
    });

    describe("Task cancellation", () => {
        it("", () => {
            // --- snippet: Task cancellation ---
            var queue = new SequentialTaskQueue();
            var ct = queue.push(token => {
                return new Promise((resolve, reject) => {
                    setTimeout(resolve, 100);
                }).then(() => new Promise((resolve, reject) => {
                    if (token.cancelled)
                        reject();
                    else
                        resolve();
                })).then(() => {
                    throw new Error("Should not ever get here");
                });
            });
            setTimeout(() => {
                ct.cancel();
            }, 50);
            // --- snip ---
            return queue.wait();
        });
    });

    describe("Timeouts", () => {
        it("", function() {
            this.timeout(0);
            // --- snippet: Timeouts ---
            // --- snip ---
            var resp = [];
            var timeouts = [20, 2000, 10]; 
            var backend = {
                echo: query => new Promise(resolve => {
                    setTimeout(() => resolve(query), timeouts.shift());
                }),
            };
            var state = {
                list: [],
                addResponse: function(response) { 
                    this.list.push(response); 
                }
            };
            // --- snip ---
            var queue = new SequentialTaskQueue();
            // ...
            function onEcho(query) {
                queue.push(token => 
                    backend.echo(query).then(response => {
                        if (!token.cancelled) {
                            state.addResponse("Server responded: " + response);
                        }
                    }), { timeout: 1000 });
            }
            // --- snip ---
            onEcho("foo");
            onEcho("bar");
            onEcho("baz");
            return queue.wait().then(() => { assert.deepEqual(state.list, ["Server responded: foo", "Server responded: baz"]); });
        });
    });

    describe("Arguments", () => {
        it("Without using args", function() {
            var handler: Function;
            var backend = {
                on: (evt: string, cb: Function) => {
                    handler = cb;
                }
            };
            var console = {
                log: sinon.spy()
            }
            var queue = new SequentialTaskQueue();
            // made some assumptions about closures and inner functions, better test that too :)
            var originalPush = queue.push.bind(queue);
            var stubId = 0;
            sinon.stub(queue, "push", (fn, opts) => {
                if (fn.__stub_id === undefined)
                    fn.__stub_id = ++stubId;
                originalPush(fn, opts);
            });
            // --- snippet: Arguments 1 ---
            backend.on("notification", (data) => {
                queue.push(() => {
                    console.log(data);
                    // todo: do something with data
                });
            });
            // --- snip ---
            handler(1);
            handler(3);
            handler(5);
            handler(7);
            return queue.wait().then(() => {
                assert.equal(stubId, 4); 
                assert.deepEqual(console.log.args, [[1], [3], [5], [7]]); 
            });
        });

        it("With args", function() {
            var handler: Function;
            var backend = {
                on: (evt: string, cb: Function) => {
                    handler = cb;
                }
            };
            var console = {
                log: sinon.spy()
            }
            var queue = new SequentialTaskQueue();
            // made some assumptions about closures and inner functions, better test that too :)
            var originalPush = queue.push.bind(queue);
            var stubId = 0;
            sinon.stub(queue, "push", (fn, opts) => {
                if (fn.__stub_id === undefined)
                    fn.__stub_id = ++stubId;
                originalPush(fn, opts);
            });
            // --- snippet: Arguments 2 ---
            backend.on("notification", (data) => {
                queue.push(handleNotifiation, { args: data });
            });

            function handleNotifiation(data) {
                console.log(data);
                // todo: do something with data
            }
            // --- snip ---
            handler(1);
            handler(3);
            handler(5);
            handler(7);
            return queue.wait().then(() => {
                assert.equal(stubId, 1); 
                assert.deepEqual(console.log.args, [[1], [3], [5], [7]]); 
            });
        });
    });

    describe("Waiting for all tasks to finish", () => {
        it("", () => {
            var task1 = ()=>{};
            var task2 = task1;
            var task3 = task2;
            // --- snippet: Wait ---
            var queue = new SequentialTaskQueue();
            queue.push(task1);
            queue.push(task2);
            queue.push(task3);
            queue.wait().then(() => { /*...*/ });
            // --- snip ---
        });
    });

    describe("Closing the queue", () => {
        it("", () => {
            // --- snippet: Close ---
            var queue = new SequentialTaskQueue();
            // ...
            function deactivate(done) {
                queue.close(true).then(done);                
            } 
            // --- snip ---
            queue.push(() => new Promise(resolve => setTimeout(resolve, 500)));
            return new Promise(resolve => {
                deactivate(resolve);
            });
        });
    });

    describe("Handling errors", () => {
        it("", () => {
            // --- snippet: Errors ---
            var queue = new SequentialTaskQueue();
            queue.push(() => new Promise((resolve, reject) => {
                setTimeout(resolve, 100);
            }).then(() => new Promise((resolve, reject) => {
                throw new Error("Epic fail");
            })));
            // --- snip ---
            var spy = sinon.spy();
            queue.on("error", spy);
            return queue.wait().then(() => assert(spy.called));
        });
    });
});
