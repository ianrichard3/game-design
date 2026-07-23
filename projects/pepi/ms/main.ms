x = 0

init = function()
  x = 0
end

update = function()
  x += 1
end

draw = function()
  screen.clear "black"
  screen.print "EDITED IN VS CODE " + x, 0, 0
end
