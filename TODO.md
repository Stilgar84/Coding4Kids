
# to fix


next to try a variation add a reset to initial button or show it in the variation


for condition, each selection should be independent. e.g. not show color or position in first selector, only station empty, top or held color icon
=> actually the condition are too small, display them as a parameter, or better as 2 parameters (for condition which need it). this also allow to use variable for some of those like specific colors
=> yes condition should be:
* parameter1: sensor (or special condition like key held)
* parameter2: value (e.g. color) only if needed (i.e. if sensor is not boolean)
  * can also be special value, like e.g. for key held
* negation is a flag which can be flipped
* how to handle AND/OR? do we need it ? should it be composible?


dock env: when view port height is big, grabber is far from station which have max height. adjust so that grabber distance from station also has max or is fixed.
also the sensor light is badly placed.
input station element get taken from bottom that is not intuitive as opposite or all other station. change the order.
make first element at the top. align to top to differentiate from stack, similar to the ouput side of the queue.

---


Filed logo shape? How to do that? Separate small module. Mostly for sandbox


# bugs

french translation

--

code can be edited will running, which is strange

allow auto restart run on change (even in non instant mode)

maybe could have some kind of infinite mode when robot loop and drawing slowly fades out just before been redrawn?

--

chrome says app cannot be installed, also it should check for updated and propose to update (ideally restoring state)

--

time traveling debugger

# text coder

assisted, convertible

# concurency



# 

add parameter for move forward too for distance instead of using repeated

* we could allow for free input on action paramter (optionally in addition for defaut proposed values)

should also have tabs for the action blocks. especially once we add more.

* breakpoint block
* newline block

# copy/cut/pasting

moving within a function, or between function. cloning, bulk delete


# variables


current iteration count? what about nested? reserved letter?


if then else end

also have variable inspector / spy

improve the value selector with +/- 1 5 10 50 100 instead of fixed values?

add a selector between basic and advanced mode 

Maybe add unary op
With abs, trigonometry function,...


# conditional

# time traveling debugger

step backward, time scruber...

# edit mode for map, read only by default

also make default map readonly unless in edit mode

# ability to save

# make lesson hierarchical

and add constraint on length

also improve exercise so that they are more constrainted

# saving custom blocks or as function

could save reusable function as blocks or just general function in library.
for example as drawing primitive.

# alt sim ideas

race car driving (different from robot handling)

train and track control (can control train speed but also switches)

# examples

AQIBAQALUAIUZI4CUAIWEBJaERdQAxSWAY4CUAM
AQIBAQATAUEGVAQyWhIeAgIYA0EEQQYWUAMXVAQyWhZRAxIPAgIX