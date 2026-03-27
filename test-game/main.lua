local x, y = 400, 300
local speed = 200

function love.load()
  love.window.setMode(800, 800, {
    resizable = true,
    vsync = true,
    minwidth = 400,
    minheight = 300
  })
end

function love.update(dt)
  if love.keyboard.isDown("left") then x = x - speed * dt end
  if love.keyboard.isDown("right") then x = x + speed * dt end
  if love.keyboard.isDown("up") then y = y - speed * dt end
  if love.keyboard.isDown("down") then y = y + speed * dt end
end

function love.draw()
  love.graphics.setBackgroundColor(0.6, 0.2, 0.3)
  love.graphics.setColor(1, 0.4, 0.7)
  love.graphics.circle("fill", x, y, 30)
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Use arrow keys to move!", 10, 10)
  love.graphics.print("LOVE2D running in VS Code!", 10, 30)
end
