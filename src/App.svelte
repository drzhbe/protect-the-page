<script lang="ts">
  import { onMount } from "svelte";
  import { isInRange } from "./base";
  import type { Id, Position } from "./types";

  let clientWidth = document.body.clientWidth;
  let clientHeight = document.body.clientHeight;
  let canvas;
  let ctx;

  let nextId = 0;
  let tick = 0;
  let spawnFrequency = 5000;
  let waveSize = 10;
  let creatureSpeed = 0.005; // 1px per tick

  let magicPagePosition: Position = { x: clientWidth / 2, y: clientHeight / 2 };
  let magicPageRange = 100;

  let player1Position: Position = { x: 0, y: 0 };
  let player1Range = 150;
  let aliveCreatures: Id[] = [];
  let collectedCreatures: Id[] = [];
  let dirtyCreatures: Id[] = [];
  let countCollectedCreatures: Record<string, number> = {};
  let creaturesInRangeOfPlayer1: Record<Id, boolean> = {};
  let positions: Record<Id, Position> = {};
  let contents: Record<Id, string> = {};

  function reset() {
    player1Position = { x: 0, y: 0 };
    aliveCreatures = [];
    collectedCreatures = [];
    dirtyCreatures = [];
    countCollectedCreatures = {};
    creaturesInRangeOfPlayer1 = {};
    positions = {};
    contents = {};
  }

  $: {
    const newCountCollectedCreatures: Record<string, number> = {};
    for (const id of collectedCreatures) {
      const key = contents[id];
      newCountCollectedCreatures[key] =
        (newCountCollectedCreatures[key] || 0) + 1;
    }
    countCollectedCreatures = newCountCollectedCreatures;
  }
  $: uniqueCollectedCreatures = Object.keys(countCollectedCreatures).sort(
    (a, b) => a.localeCompare(b)
  );

  const slate200 = "#e2e8f0";
  const slate500 = "#64748b";

  const maybeUpdateCreaturesInRange = (
    position: Position,
    range: number,
    creatures: Id[]
  ) => {
    for (const id of creatures) {
      creaturesInRangeOfPlayer1[id] = isInRange(position, positions[id], range);
    }
  };

  const maybeUpdateDirtyCreatures = (
    position: Position,
    range: number,
    creatures: Id[]
  ) => {
    for (const id of creatures) {
      const inRange = isInRange(position, positions[id], range);
      if (inRange) {
        const index = aliveCreatures.indexOf(id);
        aliveCreatures.splice(index, 1);
        dirtyCreatures = [...dirtyCreatures, id];
        delete creaturesInRangeOfPlayer1[id];
        delete positions[id];
      }
    }
  };

  onMount(() => {
    ctx = canvas.getContext("2d");
    canvas.width = clientWidth * window.devicePixelRatio;
    canvas.height = clientHeight * window.devicePixelRatio;
    canvas.style.width = clientWidth + "px";
    canvas.style.height = clientHeight + "px";
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    let frame = requestAnimationFrame(render);
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { x, y } = player1Position;
      // Player range.
      ctx.fillStyle = slate200;
      ctx.beginPath();
      ctx.arc(x, y, player1Range, 0, 2 * Math.PI);
      ctx.fill();

      // Player.
      ctx.fillStyle = slate500;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = slate200;
      ctx.font = "30px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✏️", x, y);

      // Creatures.
      for (const id of aliveCreatures) {
        const { x, y } = positions[id];
        const content = contents[id];

        ctx.fillStyle = creaturesInRangeOfPlayer1[id]
          ? `${slate500}55`
          : `${slate200}55`;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = creaturesInRangeOfPlayer1[id] ? slate200 : slate500;
        ctx.font = "30px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(content, x, y);
      }

      frame = requestAnimationFrame(render);
    }

    const eventLoopInterval = setInterval(() => {
      tick += 1;

      const target: Position = { x: clientWidth / 2, y: clientHeight / 2 };
      for (let id of aliveCreatures) {
        const { x, y } = positions[id];
        const newX = x + (target.x - x) * creatureSpeed;
        const newY = y + (target.y - y) * creatureSpeed;
        positions[id] = { x: newX, y: newY };
      }

      maybeUpdateCreaturesInRange(
        player1Position,
        player1Range,
        aliveCreatures
      );

      maybeUpdateDirtyCreatures(
        magicPagePosition,
        magicPageRange,
        aliveCreatures
      );
    }, 16);

    const spawnInterval = setInterval(() => {
      for (let i = 0; i < waveSize; i++) {
        const id = nextId++;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        aliveCreatures.push(id);
        positions[id] = { x, y };
        // contents[id] = "🐙";
        contents[id] = String.fromCharCode(Math.floor(Math.random() * 26) + 97);
      }
    }, spawnFrequency);

    const onMouseDown = (e: MouseEvent) => {
      const { x, y } = e;
      player1Position = { x, y };
      maybeUpdateCreaturesInRange(
        player1Position,
        player1Range,
        aliveCreatures
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      for (const id_ in creaturesInRangeOfPlayer1) {
        const id = Number(id_);
        if (!creaturesInRangeOfPlayer1[id]) continue;

        const content = contents[id];
        if (content === e.key) {
          const index = aliveCreatures.indexOf(id);
          aliveCreatures.splice(index, 1);
          collectedCreatures = [...collectedCreatures, id];
          delete creaturesInRangeOfPlayer1[id];
          delete positions[id];
          break;
        }
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(eventLoopInterval);
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  });
</script>

<main>
  <div class="magic-page">
    {#each dirtyCreatures as id}
      {contents[id]}
    {/each}
  </div>
  <canvas bind:this={canvas} />
  <div class="collection">
    {#each uniqueCollectedCreatures as content}
      <div>
        <div class="creature">
          {content}
        </div>
        <div class="count">{countCollectedCreatures[content]}</div>
      </div>
    {/each}
  </div>
  {#if dirtyCreatures.length > 10}
    <div class="game-over">
      <div>Game Over</div>
      <button on:click={reset}>Start again</button>
    </div>
  {/if}
</main>

<style>
  :root {
    --slate200: #e2e8f0;
    --slate500: #64748b;
  }

  .magic-page {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    border-radius: 8px;
    border: 2px solid var(--slate500);
    padding: 8px;
    width: 200px;
    height: 200px;
    display: flex;
    flex-wrap: wrap;
    word-break: break-word;
  }

  .collection {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    padding: 8px;
    background-color: var(--slate200);
    opacity: 0.75;
    border-radius: 4px;
    max-width: 145px;
  }
  .collection .creature {
    padding: 0 8px;
    border-radius: 4px;
    background-color: var(--slate500);
    color: white;
    font-family: "Courier New", Courier, monospace;
  }

  .game-over {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    background-color: var(--slate200);
    padding: 64px;
    border-radius: 8px;
    opacity: 0.95;
    font-size: 4rem;
    line-height: 6rem;
  }
</style>
