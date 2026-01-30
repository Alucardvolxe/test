import numpy as np
import matplotlib.pyplot as plt

points = np.array([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
])

rotation_matrix = np.array([
    [0, -1],
    [1,  0]
])

rotated_points = points @ rotation_matrix

plt.plot(points[:,0], points[:,1], 'o-', label='Original')
plt.plot(rotated_points[:,0], rotated_points[:,1], 'o-', label='Rotated')
plt.legend()
plt.title("Rotation using a Matrix")
plt.axis('equal')
plt.show()
