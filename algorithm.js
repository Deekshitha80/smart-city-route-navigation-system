/* =========================================================
   SMART CITY
   ROUTE ALGORITHM VISUALIZER
   BFS / DFS / BEST FIRST / A*
   ========================================================= */

const canvas =
    document.getElementById("graphCanvas");

const ctx =
    canvas.getContext("2d");

const algorithmSelect =
    document.getElementById("algorithmSelect");

const startButton =
    document.getElementById("startVisualization");

const resetButton =
    document.getElementById("resetVisualization");

const description =
    document.getElementById("algorithmDescription");

const statusBox =
    document.getElementById("algorithmStatus");

const visitedElement =
    document.getElementById("nodesVisited");

const pathElement =
    document.getElementById("pathLength");

const timeElement =
    document.getElementById("executionTime");


/* =========================================================
   GRAPH
   ========================================================= */

const nodes = [

    { id:0, x:.08, y:.50 },
    { id:1, x:.20, y:.22 },
    { id:2, x:.20, y:.78 },

    { id:3, x:.35, y:.35 },
    { id:4, x:.35, y:.65 },

    { id:5, x:.50, y:.18 },
    { id:6, x:.50, y:.50 },
    { id:7, x:.50, y:.82 },

    { id:8, x:.67, y:.32 },
    { id:9, x:.67, y:.68 },

    { id:10, x:.84, y:.22 },
    { id:11, x:.84, y:.78 },

    { id:12, x:.94, y:.50 }

];


const edges = [

    [0,1],
    [0,2],

    [1,3],
    [2,4],

    [1,5],
    [3,5],
    [3,6],

    [4,6],
    [4,7],

    [5,6],
    [5,8],

    [6,8],
    [6,9],

    [7,9],

    [8,10],
    [8,11],

    [9,11],

    [10,12],
    [11,12]

];


const START = 0;
const GOAL = 12;


/* =========================================================
   STATE
   ========================================================= */

let visitedNodes = [];
let finalPath = [];

let running = false;


/* =========================================================
   RESIZE CANVAS
   ========================================================= */

function resizeCanvas() {

    const rect =
        canvas.getBoundingClientRect();

    const ratio =
        window.devicePixelRatio || 1;

    canvas.width =
        rect.width * ratio;

    canvas.height =
        rect.height * ratio;

    ctx.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
    );

    drawGraph();

}


/* =========================================================
   NODE POSITION
   ========================================================= */

function position(node) {

    return {

        x:
            node.x *
            canvas.clientWidth,

        y:
            node.y *
            canvas.clientHeight

    };

}


/* =========================================================
   GRAPH ADJACENCY
   ========================================================= */

function buildGraph() {

    const graph =
        new Map();


    nodes.forEach(
        node => {
            graph.set(
                node.id,
                []
            );
        }
    );


    edges.forEach(
        edge => {

            graph.get(
                edge[0]
            ).push(
                edge[1]
            );

            graph.get(
                edge[1]
            ).push(
                edge[0]
            );

        }
    );


    return graph;

}


/* =========================================================
   HEURISTIC
   ========================================================= */

function heuristic(a,b) {

    const p1 =
        position(nodes[a]);

    const p2 =
        position(nodes[b]);

    return Math.hypot(
        p1.x - p2.x,
        p1.y - p2.y
    );

}


/* =========================================================
   BFS
   ========================================================= */

function bfs() {

    const graph =
        buildGraph();

    const queue = [START];

    const visited =
        new Set([START]);

    const parent =
        new Map();

    const order = [];


    while(queue.length) {

        const current =
            queue.shift();

        order.push(current);


        if(current === GOAL)
            break;


        for(const next of graph.get(current)) {

            if(!visited.has(next)) {

                visited.add(next);

                parent.set(
                    next,
                    current
                );

                queue.push(next);

            }

        }

    }


    return {

        order,

        path:
            reconstructPath(
                parent
            )

    };

}


/* =========================================================
   DFS
   ========================================================= */

function dfs() {

    const graph =
        buildGraph();

    const stack =
        [START];

    const visited =
        new Set();

    const parent =
        new Map();

    const order = [];


    while(stack.length) {

        const current =
            stack.pop();


        if(visited.has(current))
            continue;


        visited.add(current);

        order.push(current);


        if(current === GOAL)
            break;


        const neighbors =
            graph.get(current);


        for(let i = neighbors.length-1; i>=0; i--) {

            const next =
                neighbors[i];


            if(!visited.has(next)) {

                parent.set(
                    next,
                    current
                );

                stack.push(next);

            }

        }

    }


    return {

        order,

        path:
            reconstructPath(
                parent
            )

    };

}


/* =========================================================
   BEST FIRST SEARCH
   ========================================================= */

function bestFirst() {

    const graph =
        buildGraph();

    const open =
        [START];

    const visited =
        new Set();

    const parent =
        new Map();

    const order = [];


    while(open.length) {

        open.sort(
            (a,b) =>
                heuristic(a,GOAL) -
                heuristic(b,GOAL)
        );


        const current =
            open.shift();


        if(visited.has(current))
            continue;


        visited.add(current);

        order.push(current);


        if(current === GOAL)
            break;


        for(const next of graph.get(current)) {

            if(!visited.has(next)) {

                if(!parent.has(next)) {

                    parent.set(
                        next,
                        current
                    );

                }

                open.push(next);

            }

        }

    }


    return {

        order,

        path:
            reconstructPath(
                parent
            )

    };

}


/* =========================================================
   A*
   ========================================================= */

function aStar() {

    const graph =
        buildGraph();

    const open =
        [START];

    const closed =
        new Set();

    const parent =
        new Map();

    const g =
        new Map();

    const f =
        new Map();

    const order = [];


    nodes.forEach(
        node => {

            g.set(
                node.id,
                Infinity
            );

            f.set(
                node.id,
                Infinity
            );

        }
    );


    g.set(
        START,
        0
    );


    f.set(
        START,
        heuristic(
            START,
            GOAL
        )
    );


    while(open.length) {

        open.sort(
            (a,b) =>
                f.get(a) -
                f.get(b)
        );


        const current =
            open.shift();


        if(closed.has(current))
            continue;


        closed.add(current);

        order.push(current);


        if(current === GOAL)
            break;


        for(const next of graph.get(current)) {

            if(closed.has(next))
                continue;


            const tentative =
                g.get(current) +
                heuristic(
                    current,
                    next
                );


            if(tentative < g.get(next)) {

                parent.set(
                    next,
                    current
                );


                g.set(
                    next,
                    tentative
                );


                f.set(
                    next,
                    tentative +
                    heuristic(
                        next,
                        GOAL
                    )
                );


                if(!open.includes(next)) {

                    open.push(next);

                }

            }

        }

    }


    return {

        order,

        path:
            reconstructPath(
                parent
            )

    };

}


/* =========================================================
   RECONSTRUCT PATH
   ========================================================= */

function reconstructPath(parent) {

    const path = [];

    let current =
        GOAL;


    while(current !== undefined) {

        path.unshift(current);


        if(current === START)
            break;


        current =
            parent.get(current);

    }


    if(path[0] !== START)
        return [];


    return path;

}


/* =========================================================
   DRAW GRAPH
   ========================================================= */

function drawGraph() {

    if(!ctx)
        return;


    ctx.clearRect(
        0,
        0,
        canvas.clientWidth,
        canvas.clientHeight
    );


    /* EDGES */

    edges.forEach(
        edge => {

            const a =
                position(nodes[edge[0]]);

            const b =
                position(nodes[edge[1]]);


            const isPath =
                isEdgeInPath(
                    edge[0],
                    edge[1]
                );


            ctx.beginPath();

            ctx.moveTo(
                a.x,
                a.y
            );

            ctx.lineTo(
                b.x,
                b.y
            );


            ctx.lineWidth =
                isPath ? 5 : 2;


            ctx.strokeStyle =
                isPath
                    ? "#facc15"
                    : "#cbd5e1";


            ctx.stroke();

        }
    );


    /* NODES */

    nodes.forEach(
        node => {

            const p =
                position(node);


            let radius = 14;

            let fill =
                "#94a3b8";


            if(node.id === START) {

                fill =
                    "#22c55e";

            }
            else if(
                finalPath.includes(node.id)
            ) {

                fill =
                    "#facc15";

            }
            else if(
                visitedNodes.includes(node.id)
            ) {

                fill =
                    "#3155ff";

            }


            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                radius,
                0,
                Math.PI * 2
            );


            ctx.fillStyle =
                fill;

            ctx.fill();


            ctx.lineWidth = 3;

            ctx.strokeStyle =
                "#ffffff";

            ctx.stroke();


            ctx.fillStyle =
                "#ffffff";

            ctx.font =
                "bold 12px Arial";

            ctx.textAlign =
                "center";

            ctx.textBaseline =
                "middle";


            ctx.fillText(
                node.id,
                p.x,
                p.y
            );

        }
    );

}


/* =========================================================
   PATH EDGE CHECK
   ========================================================= */

function isEdgeInPath(a,b) {

    for(
        let i=0;
        i<finalPath.length-1;
        i++
    ) {

        if(
            (
                finalPath[i] === a &&
                finalPath[i+1] === b
            )
            ||
            (
                finalPath[i] === b &&
                finalPath[i+1] === a
            )
        ) {

            return true;

        }

    }

    return false;

}


/* =========================================================
   DESCRIPTION
   ========================================================= */

function updateDescription() {

    const value =
        algorithmSelect.value;


    const text = {

        bfs:
            "<strong>BFS:</strong> " +
            "Explores nodes level by level " +
            "using a queue. Useful for " +
            "unweighted graphs.",

        dfs:
            "<strong>DFS:</strong> " +
            "Explores as deeply as possible " +
            "before backtracking.",

        best:
            "<strong>Best First Search:</strong> " +
            "Uses a heuristic to explore the " +
            "node that appears closest to " +
            "the destination.",

        astar:
            "<strong>A* Search:</strong> " +
            "Combines actual path cost with " +
            "a heuristic to efficiently find " +
            "a shortest path."

    };


    description.innerHTML =
        text[value];

}


/* =========================================================
   VISUALIZE
   ========================================================= */

async function startVisualization() {

    if(running)
        return;


    running = true;

    startButton.disabled =
        true;


    visitedNodes = [];

    finalPath = [];


    resetStats();


    const algorithm =
        algorithmSelect.value;


    const startTime =
        performance.now();


    let result;


    if(algorithm === "bfs")
        result = bfs();

    else if(algorithm === "dfs")
        result = dfs();

    else if(algorithm === "best")
        result = bestFirst();

    else
        result = aStar();


    statusBox.textContent =
        "Searching graph...";


    /* ANIMATE VISITED NODES */

    for(
        const node of result.order
    ) {

        visitedNodes.push(node);

        drawGraph();

        visitedElement.textContent =
            visitedNodes.length;

        await delay(180);

    }


    /* FINAL PATH */

    finalPath =
        result.path;


    drawGraph();


    pathElement.textContent =
        finalPath.length;


    const execution =
        performance.now() -
        startTime;


    timeElement.textContent =
        execution.toFixed(2) +
        " ms";


    statusBox.textContent =
        "✓ Search completed successfully.";


    running = false;

    startButton.disabled =
        false;

}


/* =========================================================
   RESET
   ========================================================= */

function resetVisualization() {

    if(running)
        return;


    visitedNodes = [];

    finalPath = [];


    resetStats();

    drawGraph();


    statusBox.textContent =
        "Ready to visualize.";

}


/* =========================================================
   RESET STATS
   ========================================================= */

function resetStats() {

    visitedElement.textContent =
        "0";

    pathElement.textContent =
        "0";

    timeElement.textContent =
        "0 ms";

}


/* =========================================================
   DELAY
   ========================================================= */

function delay(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


/* =========================================================
   EVENTS
   ========================================================= */

algorithmSelect.addEventListener(
    "change",
    function() {

        if(!running) {

            updateDescription();

            resetVisualization();

        }

    }
);


startButton.addEventListener(
    "click",
    startVisualization
);


resetButton.addEventListener(
    "click",
    resetVisualization
);


window.addEventListener(
    "resize",
    resizeCanvas
);


/* =========================================================
   INITIAL LOAD
   ========================================================= */

updateDescription();

resizeCanvas();